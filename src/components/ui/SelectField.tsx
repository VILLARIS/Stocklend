import { ChevronDown } from "lucide-react";
import { FormField } from "./FormField";

export type SelectOption = { value: string; label: string };

interface SelectFieldProps {
  id?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  hint?: string;
  error?: string | null;
  className?: string;
}

export function SelectField({
  id,
  label,
  value,
  onChange,
  options,
  placeholder,
  required = false,
  disabled = false,
  hint,
  error,
  className = "",
}: SelectFieldProps) {
  return (
    <FormField
      label={label}
      htmlFor={id}
      required={required}
      hint={hint}
      error={error}
      className={className}
    >
      <div className="relative">
        <select
          id={id}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          className={`h-9 w-full appearance-none rounded-md border bg-surface pl-3 pr-9 text-sm text-text transition-colors duration-[120ms] hover:border-border-strong focus:border-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/20 disabled:bg-[#F1F4F8] disabled:text-text-secondary ${
            error ? "border-error" : "border-border"
          }`}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" />
      </div>
    </FormField>
  );
}
