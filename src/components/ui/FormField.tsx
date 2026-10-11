import { type ReactNode } from "react";
import { CircleAlert } from "lucide-react";

interface FormFieldProps {
  label: string;
  htmlFor?: string;
  required?: boolean;
  hint?: string;
  error?: string | null;
  className?: string;
  children: ReactNode;
}

export function FormField({
  label,
  htmlFor,
  required = false,
  hint,
  error,
  className = "",
  children,
}: FormFieldProps) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label htmlFor={htmlFor} className="text-[12.5px] font-medium text-text">
        {label}
        {required && <span className="ml-0.5 text-error">*</span>}
      </label>
      {children}
      <p
        className={`flex min-h-[16px] items-start gap-1 text-[11.5px] leading-4 ${
          error ? "text-error" : "text-text-secondary"
        }`}
      >
        {error && <CircleAlert className="mt-px h-3.5 w-3.5 shrink-0" />}
        <span>{error ?? hint ?? ""}</span>
      </p>
    </div>
  );
}
