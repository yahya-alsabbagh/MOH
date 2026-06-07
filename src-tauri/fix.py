import re

with open('src/commands.rs', 'r', encoding='utf-8') as f:
    content = f.read()

# We need to find the correct ending of get_license_status.
# The original get_license_status ends with:
#             Ok(locked_response(data, e.to_string(), is_decoy))
#         }
#     }
# }
get_lic_end = """            Ok(locked_response(data, e.to_string(), is_decoy))
        }
    }
}
"""

# Find the first occurrence of get_lic_end
idx1 = content.find(get_lic_end) + len(get_lic_end)

# Now find where the real renew_license_backdoor starts.
# We know the duplicate starts with renew_license_backdoor, but the first one was added right after get_lic_end,
# and then there's a chunk of duplicated code. Let's find the last occurrence of renew_license_backdoor.
idx2 = content.rfind('#[tauri::command(rename_all = "camelCase")]\npub fn renew_license_backdoor')

if idx1 != -1 and idx2 != -1 and idx2 > idx1:
    new_content = content[:idx1] + "\n" + content[idx2:]
    with open('src/commands.rs', 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("Fixed!")
else:
    print("Could not find the indices.")
