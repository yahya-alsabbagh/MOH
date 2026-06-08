import { useState, useRef, useEffect } from "react";
import { ChevronDown, Search, Check } from "lucide-react";

interface Option {
  value: string;
  label: string;
}

interface SearchableComboboxProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  icon?: React.ReactNode;
}

export default function SearchableCombobox({
  options,
  value,
  onChange,
  placeholder = "اختر...",
  searchPlaceholder = "بحث...",
  disabled = false,
  icon
}: SearchableComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  const filteredOptions = options.filter(opt => 
    opt.label.toLowerCase().includes(search.toLowerCase())
  );

  const selectedOption = options.find(opt => opt.value === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            setIsOpen(!isOpen);
            setSearch("");
          }
        }}
        className={`flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 ${
          disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"
        }`}
      >
        <span className={`block truncate ${!selectedOption ? "text-slate-400" : "text-slate-700"}`}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute z-[100] mt-1 w-full rounded-xl border border-slate-200 bg-white py-1 shadow-xl overflow-hidden">
          <div className="flex items-center border-b border-slate-100 px-3 py-2">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              type="text"
              autoFocus
              className="ml-2 w-full border-none bg-transparent text-sm outline-none placeholder:text-slate-400"
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              dir="rtl"
            />
          </div>
          <ul className="max-h-64 overflow-y-auto py-1">
            {filteredOptions.length === 0 ? (
              <li className="px-3 py-3 text-center text-sm text-slate-500">لا توجد نتائج</li>
            ) : (
              filteredOptions.map((opt) => (
                <li
                  key={opt.value}
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                    setSearch("");
                  }}
                  className={`flex cursor-pointer items-center justify-between px-3 py-2 text-sm transition-colors hover:bg-indigo-50 ${
                    value === opt.value ? "bg-indigo-50/50 font-bold text-indigo-700" : "text-slate-700"
                  }`}
                >
                  <span className="block truncate">{opt.label}</span>
                  {value === opt.value && <Check className="h-4 w-4 text-indigo-600" />}
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
