import * as React from "react";
import { cn } from "@/lib/utils";

// ============================================================
// 05 — NAVEGAÇÃO
// ============================================================

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumb({ items, className }: BreadcrumbProps) {
  return (
    <nav className={cn("flex items-center gap-2 text-[12.5px]", className)}>
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <React.Fragment key={index}>
            {isLast ? (
              <span className="text-text-primary font-medium">{item.label}</span>
            ) : (
              <a href={item.href || "#"} className="text-text-muted transition-colors duration-140 hover:text-orange-400">
                {item.label}
              </a>
            )}
            {!isLast && (
              <svg className="w-[13px] h-[13px] text-text-disabled" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none">
                <path d="m9 18 6-6-6-6" />
              </svg>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}

// ============================================================

export interface Tab {
  id: string;
  label: string;
}

export interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  className?: string;
}

export function Tabs({ tabs, activeTab, onTabChange, className }: TabsProps) {
  return (
    <div className={cn("flex gap-0.5 border-b border-border-hair", className)}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={cn(
            "px-[18px] py-2.5 text-[13px] font-medium transition-colors duration-140 relative",
            activeTab === tab.id ? "text-orange-400" : "text-text-secondary hover:text-text-primary"
          )}
        >
          {tab.label}
          {activeTab === tab.id && (
            <span className="absolute left-[18px] right-[18px] bottom-[-1px] h-[2px] bg-orange-500 shadow-[0_0_8px_0_rgba(255,122,26,0.16)] rounded-[2px]" />
          )}
        </button>
      ))}
    </div>
  );
}

// ============================================================

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export function Pagination({ currentPage, totalPages, onPageChange, className }: PaginationProps) {
  const pages = React.useMemo(() => {
    const result: (number | "ellipsis")[] = [];
    const showPages = 3;

    for (let i = 1; i <= totalPages; i++) {
      if (
        i === 1 ||
        i === totalPages ||
        (i >= currentPage - 1 && i <= currentPage + 1)
      ) {
        result.push(i);
      } else if (
        result[result.length - 1] !== "ellipsis" &&
        result.length > 0
      ) {
        result.push("ellipsis");
      }
    }

    return result;
  }, [currentPage, totalPages]);

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="w-8 h-8 rounded-md flex items-center justify-center text-[12.5px] font-medium transition-colors duration-140 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-bg-surface-2"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none">
          <path d="m15 18-6-6 6-6" />
        </svg>
      </button>

      {pages.map((page, index) =>
        page === "ellipsis" ? (
          <span key={`ellipsis-${index}`} className="px-2 text-text-muted">···</span>
        ) : (
          <button
            key={page}
            onClick={() => onPageChange(page as number)}
            className={cn(
              "w-8 h-8 rounded-md flex items-center justify-center text-[12.5px] font-medium transition-colors duration-140",
              page === currentPage
                ? "bg-orange-500 text-white"
                : "hover:bg-bg-surface-2"
            )}
          >
            {page}
          </button>
        )
      )}

      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="w-8 h-8 rounded-md flex items-center justify-center text-[12.5px] font-medium transition-colors duration-140 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-bg-surface-2"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none">
          <path d="m9 18 6-6-6-6" />
        </svg>
      </button>
    </div>
  );
}

// ============================================================

export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  danger?: boolean;
  divider?: boolean;
}

export interface ContextMenuProps {
  items: ContextMenuItem[];
  onSelect: (itemId: string) => void;
  onClose: () => void;
  position?: { x: number; y: number };
  className?: string;
}

export function ContextMenu({
  items,
  onSelect,
  onClose,
  position,
  className,
}: ContextMenuProps) {
  React.useEffect(() => {
    const handleClick = () => onClose();
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [onClose]);

  return (
    <div
      className={cn(
        "fixed bg-bg-surface-2 border border-border-soft rounded-md py-1 min-w-[180px] shadow-[0_12px_28px_rgba(0,0,0,0.35)] z-50",
        className
      )}
      style={position ? { left: position.x, top: position.y } : {}}
    >
      {items.map((item) =>
        item.divider ? (
          <div key={item.id} className="my-1 h-px bg-border-hair" />
        ) : (
          <button
            key={item.id}
            onClick={() => {
              onSelect(item.id);
              onClose();
            }}
            className={cn(
              "w-full px-3 py-2 text-[13px] flex items-center gap-2.5 transition-colors duration-140 hover:bg-bg-surface-3",
              item.danger ? "text-red-400" : "text-text-primary"
            )}
          >
            {item.icon && <span className="w-4 h-4">{item.icon}</span>}
            {item.label}
          </button>
        )
      )}
    </div>
  );
}

// ============================================================

export interface DropdownItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  danger?: boolean;
}

export interface DropdownProps {
  trigger: React.ReactNode;
  items: DropdownItem[];
  onSelect: (itemId: string) => void;
  align?: "left" | "right";
  className?: string;
}

export function Dropdown({
  trigger,
  items,
  onSelect,
  align = "left",
  className,
}: DropdownProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  React.useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (!(e.target as Element).closest(".dropdown-trigger")) {
        setIsOpen(false);
      }
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  return (
    <div className={cn("relative inline-block dropdown-trigger", className)}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5"
      >
        {trigger}
        <svg
          className={cn("w-4 h-4 transition-transform duration-140", isOpen && "rotate-180")}
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {isOpen && (
        <div
          className={cn(
            "absolute mt-1.5 bg-bg-surface-2 border border-border-soft rounded-md py-1 min-w-[160px] shadow-[0_12px_28px_rgba(0,0,0,0.35)] z-10",
            align === "right" ? "right-0" : "left-0"
          )}
        >
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                onSelect(item.id);
                setIsOpen(false);
              }}
              className={cn(
                "w-full px-3 py-2 text-[13px] flex items-center gap-2.5 transition-colors duration-140 hover:bg-bg-surface-3",
                item.danger ? "text-red-400" : "text-text-primary"
              )}
            >
              {item.icon && <span className="w-4 h-4">{item.icon}</span>}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================

export interface CommandPaletteItem {
  id: string;
  label: string;
  section?: string;
  shortcut?: string;
  icon?: React.ReactNode;
}

export interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  items: CommandPaletteItem[];
  placeholder?: string;
  onSearch?: (query: string) => void;
  onSelect: (item: CommandPaletteItem) => void;
}

export function CommandPalette({
  isOpen,
  onClose,
  items,
  placeholder = "Buscar lead, proposta, ação...",
  onSearch,
  onSelect,
}: CommandPaletteProps) {
  const [searchTerm, setSearchTerm] = React.useState("");
  const [selectedIndex, setSelectedIndex] = React.useState(0);

  React.useEffect(() => {
    if (isOpen) {
      setSearchTerm("");
      setSelectedIndex(0);
    }
  }, [isOpen]);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, filteredItems.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter" && filteredItems[selectedIndex]) {
        e.preventDefault();
        onSelect(filteredItems[selectedIndex]);
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, selectedIndex, filteredItems, onSelect]);

  const filteredItems = React.useMemo(() => {
    if (!searchTerm) return items;
    return items.filter((item) =>
      item.label.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [items, searchTerm]);

  const groupedItems = React.useMemo(() => {
    const groups: Record<string, CommandPaletteItem[]> = {};
    filteredItems.forEach((item) => {
      const section = item.section || "Geral";
      if (!groups[section]) groups[section] = [];
      groups[section].push(item);
    });
    return groups;
  }, [filteredItems]);

  let globalIndex = 0;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      <div className="absolute inset-0 bg-bg-overlay" onClick={onClose} />
      <div className="relative w-full max-w-[560px] bg-bg-surface-2 border border-border-soft rounded-lg shadow-[0_24px_48px_rgba(0,0,0,0.4)] overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border-hair">
          <svg className="w-5 h-5 text-text-muted" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none">
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={placeholder}
            className="flex-1 bg-transparent outline-none text-text-primary text-[14px]"
            autoFocus
          />
          <kbd className="px-2 py-0.5 text-[10px] text-text-muted bg-bg-surface-3 rounded">ESC</kbd>
        </div>
        <div className="max-h-[320px] overflow-y-auto py-2">
          {Object.entries(groupedItems).map(([section, sectionItems]) => (
            <div key={section} className="mb-3">
              <div className="px-4 py-1.5 text-[10.5px] text-text-muted uppercase tracking-wider font-mono">
                {section}
              </div>
              {sectionItems.map((item) => {
                const currentIndex = globalIndex++;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      onSelect(item);
                      onClose();
                    }}
                    className={cn(
                      "w-full px-4 py-2.5 flex items-center gap-3 transition-colors duration-140",
                      currentIndex === selectedIndex ? "bg-bg-surface-3" : "hover:bg-bg-surface-3"
                    )}
                  >
                    {item.icon && <span className="w-4 h-4 text-text-secondary">{item.icon}</span>}
                    <span className="flex-1 text-left text-[13px] text-text-primary">{item.label}</span>
                    {item.shortcut && (
                      <kbd className="px-1.5 py-0.5 text-[9px] text-text-muted bg-bg-surface-3 rounded">
                        {item.shortcut}
                      </kbd>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
