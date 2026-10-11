import { useRef, type KeyboardEvent } from "react";
import { Package, Boxes, Tags, type LucideIcon } from "lucide-react";

export type InventoryTabKey = "articulos" | "unidades" | "categorias";

interface TabDef {
  key: InventoryTabKey;
  label: string;
  icon: LucideIcon;
}

const tabs: TabDef[] = [
  { key: "articulos", label: "Artículos", icon: Package },
  { key: "unidades", label: "Unidades", icon: Boxes },
  { key: "categorias", label: "Categorías", icon: Tags },
];

interface InventoryTabsProps {
  value: InventoryTabKey;
  onChange: (key: InventoryTabKey) => void;
}

export function InventoryTabs({ value, onChange }: InventoryTabsProps) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const current = tabs.findIndex((tab) => tab.key === value);
    const delta = event.key === "ArrowRight" ? 1 : -1;
    const next = (current + delta + tabs.length) % tabs.length;
    onChange(tabs[next].key);
    refs.current[next]?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label="Secciones del inventario"
      onKeyDown={onKeyDown}
      className="flex items-center gap-1 border-b border-border-soft px-2"
    >
      {tabs.map((tab, index) => {
        const active = tab.key === value;
        const Icon = tab.icon;
        return (
          <button
            key={tab.key}
            ref={(el) => {
              refs.current[index] = el;
            }}
            type="button"
            role="tab"
            id={`inv-tab-${tab.key}`}
            aria-selected={active}
            aria-controls={`inv-panel-${tab.key}`}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(tab.key)}
            className={`relative flex h-11 items-center gap-2 rounded-t-md px-3 text-[13.5px] font-medium transition-colors duration-[120ms] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
              active
                ? "text-brand"
                : "text-text-secondary hover:text-text"
            }`}
          >
            <Icon className="h-[16px] w-[16px] shrink-0" />
            {tab.label}
            <span
              className={`absolute inset-x-2 bottom-0 h-[2px] rounded-full bg-brand transition-opacity duration-[120ms] ${
                active ? "opacity-100" : "opacity-0"
              }`}
            />
          </button>
        );
      })}
    </div>
  );
}
