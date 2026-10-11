
import {
  useEffect,
  useId,
  useRef,
  type ReactNode,
  type RefObject,
} from "react";

import { createPortal } from "react-dom";
import { X } from "lucide-react";

type DialogSize = "sm" | "md" | "lg" | "xl";

const sizes: Record<DialogSize, string> = {
  sm: "max-w-[480px]",
  md: "max-w-[600px]",
  lg: "max-w-[720px]",
  xl: "max-w-[860px]",
};

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  size?: DialogSize;
  initialFocusRef?: RefObject<HTMLElement | null>;
  footer?: ReactNode;
  children: ReactNode;
}

export function Dialog({
  open,
  onClose,
  title,
  subtitle,
  size = "md",
  initialFocusRef,
  footer,
  children,
}: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const subtitleId = useId();

  useEffect(() => {
    if (!open) return;

    const previouslyFocused =
      document.activeElement as HTMLElement | null;

    const node = panelRef.current;

    // ----------------------------------------
    // ENFOQUE INICIAL
    // ----------------------------------------

    const timer = window.setTimeout(() => {
      const target =
        initialFocusRef?.current ??
        node?.querySelector<HTMLElement>(FOCUSABLE) ??
        node;

      target?.focus();
    }, 0);

    // ----------------------------------------
    // TECLADO Y FOCUS TRAP
    // ----------------------------------------

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose();
        return;
      }

      if (event.key !== "Tab" || !node) {
        return;
      }

      const focusable = Array.from(
        node.querySelectorAll<HTMLElement>(FOCUSABLE)
      ).filter((element) => {
        return (
          element.getClientRects().length > 0 &&
          !element.hasAttribute("disabled") &&
          element.getAttribute("aria-hidden") !== "true"
        );
      });

      if (focusable.length === 0) {
        event.preventDefault();
        node.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (
        event.shiftKey &&
        (active === first || !node.contains(active))
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (active === last || !node.contains(active))
      ) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener(
      "keydown",
      handleKeyDown,
      true
    );

    // ----------------------------------------
    // BLOQUEAR SCROLL DEL FONDO
    // ----------------------------------------

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow = "hidden";

    return () => {
      window.clearTimeout(timer);

      document.removeEventListener(
        "keydown",
        handleKeyDown,
        true
      );

      document.body.style.overflow =
        previousOverflow;

      previouslyFocused?.focus?.();
    };
  }, [open, onClose, initialFocusRef]);

  if (!open) {
    return null;
  }

  return createPortal(
    <div
      className="
        fixed inset-0 z-[100]
        flex items-center justify-center
        p-3 sm:p-5
      "
    >
      {/* =====================================
          FONDO OSCURECIDO
      ===================================== */}

      <div
        aria-hidden="true"
        className="
          absolute inset-0
          bg-[#14233B]/40
          backdrop-blur-[4px]
        "
      />

      {/* =====================================
          CONTENEDOR PRINCIPAL
      ===================================== */}

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={
          subtitle ? subtitleId : undefined
        }
        tabIndex={-1}
        className={`
          relative flex w-full min-w-0
          flex-col overflow-hidden

          max-h-[calc(100dvh-24px)]
          sm:max-h-[calc(100dvh-40px)]

          rounded-[20px]
          border border-white/90
          bg-white

          shadow-[0_24px_80px_-16px_rgba(17,47,94,0.30)]

          ${sizes[size]}
        `}
      >
        {/* =====================================
            ENCABEZADO
        ===================================== */}

        <header
          className="
            flex shrink-0 items-start
            justify-between gap-4

            border-b border-[#E9EEF6]
            bg-white

            px-5 py-4
            sm:px-6
          "
        >
          <div className="flex min-w-0 items-start gap-3">
            {/* Icono del modal */}
            <div
              className="
                mt-0.5 flex h-10 w-10
                shrink-0 items-center
                justify-center
                rounded-[12px]

                bg-[#E9F2FF]
                text-[#267BFA]
              "
              aria-hidden="true"
            >
              <span className="text-[19px] font-bold leading-none">
                +
              </span>
            </div>

            <div className="min-w-0">
              <h2
                id={titleId}
                className="
                  text-[17px] font-bold
                  leading-6 tracking-tight
                  text-[#182B50]
                "
              >
                {title}
              </h2>

              {subtitle && (
                <p
                  id={subtitleId}
                  className="
                    mt-1 text-[12px]
                    leading-[18px]
                    text-[#7C8CA5]
                  "
                >
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          {/* CERRAR */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            title="Cerrar"
            className="
              flex h-8 w-8 shrink-0
              items-center justify-center
              rounded-lg

              text-[#8090A7]
              transition-[background-color,color]
              duration-200

              hover:bg-[#EDF3FA]
              hover:text-[#234875]

              focus-visible:outline
              focus-visible:outline-2
              focus-visible:outline-offset-2
              focus-visible:outline-[#398BFF]
            "
          >
            <X className="h-[18px] w-[18px]" />
          </button>
        </header>

        {/* =====================================
            CONTENIDO
        ===================================== */}

        <div
          className="
            min-h-0 flex-1
            overflow-x-hidden overflow-y-auto
            overscroll-contain

            bg-white

            px-5 py-4
            sm:px-6 sm:py-5
          "
        >
          {children}
        </div>

        {/* =====================================
            PIE DEL MODAL
        ===================================== */}

        {footer && (
          <footer
            className="
              flex shrink-0 flex-wrap
              items-center justify-end gap-2.5

              border-t border-[#E9EEF6]
              bg-[#FBFCFF]

              px-5 py-3.5
              sm:px-6
            "
          >
            {footer}
          </footer>
        )}
      </div>
    </div>,
    document.body
  );
}
