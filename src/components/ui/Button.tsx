
import {
  type ButtonHTMLAttributes,
  forwardRef,
} from "react";

type Variant =
  | "primary"
  | "secondary"
  | "tertiary"
  | "destructive"
  | "icon"
  | "sidebar";

interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const base = `
  inline-flex items-center justify-center
  font-medium
  transition-colors duration-[120ms]
  focus-visible:outline-2
  focus-visible:outline-offset-2
  focus-visible:outline-brand
  disabled:pointer-events-none
  disabled:opacity-60
`;

const variants: Record<Variant, string> = {
  primary: `
    h-9 min-w-24 rounded-md
    bg-brand px-4 text-sm text-white
    hover:bg-brand-hover
    active:bg-brand-dark
    disabled:bg-border
    disabled:text-text-secondary
  `,

  secondary: `
    h-9 min-w-24 rounded-md
    border border-border-strong
    bg-surface px-4 text-sm text-brand
    hover:bg-[#EEF2F8]
    active:bg-[#E8F0FB]
  `,

  tertiary: `
    h-9 min-w-0 rounded-md
    px-2 text-sm text-brand
    hover:bg-[#E8F0FB]
    active:bg-[#E8F0FB]
  `,

  destructive: `
    h-9 min-w-24 rounded-md
    bg-error px-4 text-sm text-white
    hover:bg-[#9A2019]
    active:bg-[#7D1A15]
  `,

  icon: `
    h-9 w-9 rounded-md
    text-text-secondary
    hover:bg-[#E6EBF2]
    active:bg-[#E6EBF2]
  `,

  // Botón destacado con estilo inspirado en el sidebar.
  sidebar: `
    h-10 min-w-0 gap-2
    rounded-xl px-4
    border border-[#69A7FF]/40
    bg-gradient-to-r
    from-[#287CF3] via-[#348AFF] to-[#60A5FA]
    text-[13px] font-semibold text-white

    shadow-[0_4px_13px_rgba(40,124,243,0.22)]

    !transition-all !duration-200 ease-out

    hover:from-[#1D6FEB]
    hover:via-[#267FF6]
    hover:to-[#5099F5]
    hover:shadow-[0_8px_22px_rgba(40,124,243,0.32)]
    hover:-translate-y-[1px]

    active:translate-y-0
    active:shadow-[0_2px_8px_rgba(40,124,243,0.18)]

    focus-visible:outline-[#348AFF]

    disabled:translate-y-0
    disabled:shadow-none
  `,
};

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonProps
>(
  (
    {
      variant = "primary",
      className = "",
      children,
      ...props
    },
    ref
  ) => (
    <button
      ref={ref}
      className={`${base} ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
);

Button.displayName = "Button";
