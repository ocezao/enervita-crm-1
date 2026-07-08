import * as React from "react";
import { cn } from "@/lib/utils";

// ============================================================
// 06 — OVERLAYS & FEEDBACK
// ============================================================

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  type?: "confirmation" | "warning" | "info";
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void;
  isLoading?: boolean;
}

export function Modal({
  isOpen,
  onClose,
  type = "warning",
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  onConfirm,
  isLoading,
}: ModalProps) {
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const iconColors = {
    warning: "bg-amber-500/12 text-amber-500",
    confirmation: "bg-orange-500/12 text-orange-400",
    info: "bg-blue-400/12 text-blue-400",
  };

  const icons = {
    warning: (
      <>
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        <path d="M12 9v4M12 17h.01" />
      </>
    ),
    confirmation: (
      <>
        <circle cx="12" cy="12" r="10" />
        <path d="M12 8v4M12 16h.01" />
      </>
    ),
    info: (
      <>
        <circle cx="12" cy="12" r="10" />
        <path d="M12 16v-4M12 8h.01" />
      </>
    ),
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-bg-overlay" onClick={onClose} />
      <div className="relative bg-bg-surface-1 border border-border-soft rounded-lg p-6 max-w-[420px] shadow-[0_24px_48px_rgba(0,0,0,0.4)]">
        <div className="flex items-start gap-4 mb-5">
          <div className={cn("w-10 h-10 rounded-md flex items-center justify-center flex-shrink-0", iconColors[type])}>
            <svg className="w-5 h-5" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.7" fill="none">
              {icons[type]}
            </svg>
          </div>
          <div className="flex-1">
            <h4 className="font-display text-[15px] font-semibold mb-1">{title}</h4>
            <p className="text-[13px] text-text-secondary leading-relaxed">{description}</p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="btn btn-secondary px-4 py-2 text-[12.5px]"
          >
            {cancelLabel}
          </button>
          <button
            onClick={() => {
              onConfirm?.();
              onClose();
            }}
            disabled={isLoading}
            className={cn(
              "btn px-4 py-2 text-[12.5px]",
              type === "warning" ? "btn-danger" : "btn-primary"
            )}
          >
            {isLoading ? "Carregando..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastProps {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
  onClose: (id: string) => void;
}

export function Toast({ id, type, message, duration = 4000, onClose }: ToastProps) {
  React.useEffect(() => {
    const timer = setTimeout(() => onClose(id), duration);
    return () => clearTimeout(timer);
  }, [id, duration, onClose]);

  const styles = {
    success: {
      container: "bg-bg-surface-2 border-mint-500/30",
      icon: "bg-mint-400/12 text-mint-400",
      iconPath: <path d="M20 6L9 17l-5-5" />,
    },
    error: {
      container: "bg-bg-surface-2 border-red-500/30",
      icon: "bg-red-500/12 text-red-400",
      iconPath: (
        <>
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v4M12 16h.01" />
        </>
      ),
    },
    warning: {
      container: "bg-bg-surface-2 border-amber-500/30",
      icon: "bg-amber-500/12 text-amber-500",
      iconPath: (
        <>
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          <path d="M12 9v4M12 17h.01" />
        </>
      ),
    },
    info: {
      container: "bg-bg-surface-2 border-blue-400/30",
      icon: "bg-blue-400/12 text-blue-400",
      iconPath: (
        <>
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4M12 8h.01" />
        </>
      ),
    },
  };

  return (
    <div className={cn(
      "flex items-center gap-3 px-4 py-3 rounded-md border min-w-[320px] shadow-[0_8px_16px_rgba(0,0,0,0.24)]",
      styles[type].container
    )}>
      <div className={cn("w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0", styles[type].icon)}>
        <svg className="w-4 h-4" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.7" fill="none">
          {styles[type].iconPath}
        </svg>
      </div>
      <p className="flex-1 text-[13px] text-text-primary">{message}</p>
      <button
        onClick={() => onClose(id)}
        className="w-6 h-6 flex items-center justify-center text-text-muted hover:text-text-primary transition-colors"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

// ============================================================

export interface ToastContainerProps {
  toasts: ToastProps[];
  onDismiss: (id: string) => void;
  position?: "top-right" | "bottom-right" | "top-center" | "bottom-center";
}

export function ToastContainer({
  toasts,
  onDismiss,
  position = "top-right",
}: ToastContainerProps) {
  const positionClasses = {
    "top-right": "top-4 right-4",
    "bottom-right": "bottom-4 right-4",
    "top-center": "top-4 left-1/2 -translate-x-1/2",
    "bottom-center": "bottom-4 left-1/2 -translate-x-1/2",
  };

  return (
    <div className={cn("fixed z-50 flex flex-col gap-2", positionClasses[position])}>
      {toasts.map((toast) => (
        <Toast key={toast.id} {...toast} onClose={onDismiss} />
      ))}
    </div>
  );
}

// ============================================================

export interface TooltipProps {
  content: string;
  children: React.ReactNode;
  position?: "top" | "bottom" | "left" | "right";
  className?: string;
}

export function Tooltip({ content, children, position = "top", className }: TooltipProps) {
  const [isVisible, setIsVisible] = React.useState(false);

  const positionClasses = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  };

  const arrowClasses = {
    top: "absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-bg-surface-3",
    bottom: "absolute bottom-full left-1/2 -translate-x-1/2 -mb-1 border-l-4 border-r-4 border-b-4 border-l-transparent border-r-transparent border-b-bg-surface-3",
    left: "absolute left-full top-1/2 -translate-y-1/2 -ml-1 border-t-4 border-b-4 border-l-4 border-t-transparent border-b-transparent border-l-bg-surface-3",
    right: "absolute right-full top-1/2 -translate-y-1/2 -mr-1 border-t-4 border-b-4 border-r-4 border-t-transparent border-b-transparent border-r-bg-surface-3",
  };

  return (
    <div
      className={cn("relative inline-block", className)}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      {isVisible && (
        <div className={cn(
          "absolute z-50 bg-bg-surface-3 border border-border-soft rounded-md px-2.5 py-1.5 text-[11.5px] text-text-primary whitespace-nowrap shadow-[0_8px_16px_rgba(0,0,0,0.24)]",
          positionClasses[position]
        )}>
          {content}
          <div className={arrowClasses[position]} />
        </div>
      )}
    </div>
  );
}

// ============================================================

export interface PopoverProps {
  trigger: React.ReactNode;
  content: React.ReactNode;
  align?: "left" | "center" | "right";
  className?: string;
}

export function Popover({ trigger, content, align = "left", className }: PopoverProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  React.useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (!(e.target as Element).closest(".popover-trigger")) {
        setIsOpen(false);
      }
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  return (
    <div className={cn("relative inline-block popover-trigger", className)}>
      <div onClick={() => setIsOpen(!isOpen)}>{trigger}</div>
      {isOpen && (
        <div
          className={cn(
            "absolute mt-2 bg-bg-surface-2 border border-border-soft rounded-md p-4 min-w-[200px] shadow-[0_12px_28px_rgba(0,0,0,0.35)] z-10",
            align === "right" ? "right-0" : align === "center" ? "left-1/2 -translate-x-1/2" : "left-0"
          )}
        >
          {content}
        </div>
      )}
    </div>
  );
}

// ============================================================

export interface SkeletonProps {
  className?: string;
  variant?: "text" | "circular" | "rounded" | "rectangular";
  width?: string | number;
  height?: string | number;
}

export function Skeleton({
  className,
  variant = "text",
  width,
  height,
}: SkeletonProps) {
  const variantClasses = {
    text: "h-3 rounded",
    circular: "rounded-full",
    rounded: "rounded-md",
    rectangular: "rounded",
  };

  return (
    <div
      className={cn(
        "bg-bg-surface-3 animate-pulse",
        variantClasses[variant],
        className
      )}
      style={{ width, height }}
    />
  );
}

// ============================================================

export interface AlertBannerProps {
  type?: "warning" | "info" | "success" | "error";
  icon?: React.ReactNode;
  message: string;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  onDismiss?: () => void;
  className?: string;
}

export function AlertBanner({
  type = "info",
  icon,
  message,
  action,
  onDismiss,
  className,
}: AlertBannerProps) {
  const styles = {
    warning: {
      container: "bg-amber-500/8 border border-amber-500/20",
      icon: "text-amber-500",
      iconPath: (
        <>
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          <path d="M12 9v4M12 17h.01" />
        </>
      ),
    },
    info: {
      container: "bg-blue-400/8 border border-blue-400/20",
      icon: "text-blue-400",
      iconPath: (
        <>
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4M12 8h.01" />
        </>
      ),
    },
    success: {
      container: "bg-mint-500/8 border border-mint-500/20",
      icon: "text-mint-400",
      iconPath: <path d="M20 6L9 17l-5-5" />,
    },
    error: {
      container: "bg-red-500/8 border border-red-500/20",
      icon: "text-red-400",
      iconPath: (
        <>
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v4M12 16h.01" />
        </>
      ),
    },
  };

  return (
    <div className={cn(
      "flex items-start gap-3 px-4 py-3 rounded-md",
      styles[type].container,
      className
    )}>
      <div className={cn("w-5 h-5 flex-shrink-0 mt-0.5", styles[type].icon)}>
        <svg className="w-full h-full" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.7" fill="none">
          {icon || styles[type].iconPath}
        </svg>
      </div>
      <p className="flex-1 text-[13px]">{message}</p>
      {action && (
        <a
          href={action.href}
          onClick={action.onClick}
          className="text-[13px] font-medium text-orange-400 hover:text-orange-200 transition-colors cursor-pointer"
        >
          {action.label} →
        </a>
      )}
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="w-5 h-5 flex items-center justify-center text-text-muted hover:text-text-primary transition-colors"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}
