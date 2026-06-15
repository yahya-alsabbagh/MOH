import fs from 'fs';

const text = fs.readFileSync('src-tauri/license.txt', 'utf8');

let rtf = '{\\rtf1\\ansi\\ansicpg1252\\deff0\\nouicompat{\\fonttbl{\\f0\\fnil\\fcharset0 Tahoma;}}\n';
rtf += '{\\*\\generator Node}\\viewkind4\\uc1\n';
rtf += '\\pard\\sa200\\sl276\\slmult1\\f0\\fs22\\lang1\n';

for (let i = 0; i < text.length; i++) {
  const charCode = text.charCodeAt(i);
  if (charCode > 127) {
    rtf += '\\u' + charCode + '?';
  } else if (text[i] === '\n') {
    rtf += '\\par\n';
  } else if (text[i] === '\\' || text[i] === '{' || text[i] === '}') {
    rtf += '\\' + text[i];
  } else {
    rtf += text[i];
  }
}
rtf += '\n}';

fs.writeFileSync('src-tauri/license.rtf', rtf);
console.log('RTF created');
