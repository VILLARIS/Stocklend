
import {
  useRef,
  type KeyboardEvent,
} from "react";

import {
  Package,
  Boxes,
  Tags,
  type LucideIcon,
} from "lucide-react";

export type InventoryTabKey =
  | "articulos"
  | "unidades"
  | "categorias";

interface TabDef {
  key: InventoryTabKey;
  label: string;
  icon: LucideIcon;
}

const tabs: TabDef[] = [
  {
    key: "articulos",
    label: "Artículos",
    icon: Package,
  },
  {
    key: "unidades",
    label: "Unidades",
    icon: Boxes,
  },
  {
    key: "categorias",
    label: "Categorías",
    icon: Tags,
  },
];

interface InventoryTabsProps {
  value: InventoryTabKey;
  onChange: (key: InventoryTabKey) => void;
}

export function InventoryTabs({
  value,
  onChange,
}: InventoryTabsProps) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const onKeyDown = (
    event: KeyboardEvent<HTMLDivElement>
  ) => {
    if (
      event.key !== "ArrowRight" &&
      event.key !== "ArrowLeft"
    ) {
      return;
    }

    event.preventDefault();

    const current = tabs.findIndex(
      (tab) => tab.key === value
    );

    const delta =
      event.key === "ArrowRight" ? 1 : -1;

    const next =
      (current + delta + tabs.length) %
      tabs.length;

    onChange(tabs[next].key);
    refs.current[next]?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label="Secciones del inventario"
      onKeyDown={onKeyDown}
      className="
        flex min-w-0 items-center
        gap-2 overflow-x-auto
        border-b border-[#E7EEF7]
        bg-white/70 px-4
      "
    >
      {tabs.map((tab, index) => {
        const active = tab.key === value;
        const Icon = tab.icon;

        return (
          <button
            key={tab.key}
            ref={(element) => {
              refs.current[index] = element;
            }}
            type="button"
            role="tab"
            id={`inv-tab-${tab.key}`}
            aria-selected={active}
            aria-controls={`inv-panel-${tab.key}`}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(tab.key)}
            className={`
              group relative
              flex h-[50px] shrink-0
              items-center gap-2
              rounded-t-lg px-3
              text-[13px] font-semibold

              transition-colors duration-200
              focus-visible:outline-2
              focus-visible:outline-offset-[-2px]
              focus-visible:outline-[#237EFF]

              ${
                active
                  ? "text-[#1769D8]"
                  : "text-[#64758E] hover:text-[#264879]"
              }
            `}
          >
            <Icon
              className={`
                h-[17px] w-[17px]
                shrink-0 transition-colors
                duration-200
                ${
                  active
                    ? "text-[#237EFF]"
                    : "text-[#798AA4] group-hover:text-[#267BFA]"
                }
              `}
              strokeWidth={active ? 2.1 : 1.8}
            />

            <span>{tab.label}</span>

            <span
              className={`
                pointer-events-none
                absolute bottom-0
                left-2 right-2
                h-[2.5px] rounded-full
                bg-[#237EFF]
                transition-opacity duration-200

                ${
                  active
                    ? "opacity-100"
                    : "opacity-0"
                }
              `}
            />
          </button>
        );
      })}
    </div>
  );
}
