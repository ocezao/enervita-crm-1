import * as React from "react";
import { cn } from "@/lib/utils";

// ============================================================
// 04 — FORMULÁRIOS
// ============================================================

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, hint, className, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && <label className="text-[12px] text-text-secondary font-medium">{label}</label>}
        <textarea
          ref={ref}
          className={cn(
            "bg-bg-surface-2 border border-border-soft rounded-md px-3.5 py-2.5 text-text-primary text-[13.5px] outline-none transition-colors duration-240 hover:border-border-strong focus:border-orange-500 focus:shadow-[0_0_0_3px_rgba(255,122,26,0.16)] resize-y min-h-[80px] leading-relaxed",
            className
          )}
          {...props}
        />
        {hint && <span className="text-[11px] text-text-muted">{hint}</span>}
      </div>
    );
  }
);
Textarea.displayName = "Textarea";

// ============================================================

export interface InputWithIconProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon: React.ReactNode;
  label?: string;
}

export const InputWithIcon = React.forwardRef<HTMLInputElement, InputWithIconProps>(
  ({ icon, label, className, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && <label className="text-[12px] text-text-secondary font-medium">{label}</label>}
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 w-[15px] h-[15px] text-text-muted pointer-events-none">
            {icon}
          </span>
          <input
            ref={ref}
            className={cn(
              "bg-bg-surface-2 border border-border-soft rounded-md pl-9 pr-3.5 py-2.5 text-text-primary text-[13.5px] outline-none transition-colors duration-240 hover:border-border-strong focus:border-orange-500 focus:shadow-[0_0_0_3px_rgba(255,122,26,0.16)] w-full",
              className
            )}
            {...props}
          />
        </div>
      </div>
    );
  }
);
InputWithIcon.displayName = "InputWithIcon";

// ============================================================

export interface InlineValidationProps {
  status: "success" | "error";
  message?: string;
  children: React.ReactElement;
}

export function InlineValidation({ status, message, children }: InlineValidationProps) {
  const isValid = status === "success";

  return (
    <div className="flex flex-col gap-1.5">
      {React.cloneElement(children, {
        className: cn(
          children.props.className,
          isValid
            ? "border-mint-500 !border-mint-500"
            : "border-red-500 !border-red-500"
        ),
      })}
      {message && (
        <div className={cn("text-[11px] flex items-center gap-1.5", isValid ? "text-mint-400" : "text-red-400")}>
          <svg className="w-3 h-3" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" fill="none">
            {isValid ? (
              <path d="M20 6L9 17l-5-5" />
            ) : (
              <>
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v4M12 16h.01" />
              </>
            )}
          </svg>
          <span>{message}</span>
        </div>
      )}
    </div>
  );
}

// ============================================================

export interface CheckboxProps {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  label?: string;
  className?: string;
}

export function Checkbox({ checked = false, onCheckedChange, label, className }: CheckboxProps) {
  return (
    <label className={cn("flex items-center gap-2.5 cursor-pointer group", className)}>
      <div
        onClick={() => onCheckedChange?.(!checked)}
        className={cn(
          "w-[18px] h-[18px] rounded-[6px] border-[1.5px] flex-shrink-0 flex items-center justify-center transition-colors duration-140",
          checked ? "bg-orange-500 border-orange-500" : "border-border-strong group-hover:border-orange-500"
        )}
      >
        <svg
          className="w-[11px] h-[11px] text-[#1A0D02] transition-opacity duration-140"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="3"
          fill="none"
          style={{ opacity: checked ? 1 : 0 }}
        >
          <path d="M20 6L9 17l-5-5" />
        </svg>
      </div>
      {label && <span className="text-[13px] text-text-primary">{label}</span>}
    </label>
  );
}

// ============================================================

export interface RadioProps {
  checked?: boolean;
  onChange?: () => void;
  label?: string;
  className?: string;
}

export function Radio({ checked = false, onChange, label, className }: RadioProps) {
  return (
    <label className={cn("flex items-center gap-2.5 cursor-pointer group", className)}>
      <div
        onClick={onChange}
        className={cn(
          "w-[18px] h-[18px] rounded-full border-[1.5px] flex-shrink-0 flex items-center justify-center transition-colors duration-140",
          checked ? "border-orange-500" : "border-border-strong group-hover:border-orange-500"
        )}
      >
        <div
          className={cn(
            "w-[9px] h-[9px] rounded-full bg-orange-500 transition-opacity duration-140",
            checked ? "opacity-100" : "opacity-0"
          )}
        />
      </div>
      {label && <span className="text-[13px] text-text-primary">{label}</span>}
    </label>
  );
}

// ============================================================

export interface DatePickerProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const DatePicker = React.forwardRef<HTMLInputElement, DatePickerProps>(
  ({ label, className, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && <label className="text-[12px] text-text-secondary font-medium">{label}</label>}
        <div className="relative">
          <input
            ref={ref}
            className={cn(
              "bg-bg-surface-2 border border-border-soft rounded-md px-3.5 py-2.5 pr-9 text-text-primary text-[13.5px] outline-none transition-colors duration-240 hover:border-border-strong focus:border-orange-500 focus:shadow-[0_0_0_3px_rgba(255,122,26,0.16)] w-full",
              className
            )}
            {...props}
          />
          <svg
            className="absolute right-3 top-1/2 -translate-y-1/2 w-[15px] h-[15px] text-text-muted pointer-events-none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="1.7"
            fill="none"
          >
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <path d="M3 9h18M8 2v4M16 2v4" />
          </svg>
        </div>
      </div>
    );
  }
);
DatePicker.displayName = "DatePicker";

// ============================================================

export interface DropzoneProps {
  onDrop?: (files: File[]) => void;
  accept?: string;
  maxSize?: string;
  title?: string;
  description?: string;
  className?: string;
  children?: React.ReactNode;
}

export function Dropzone({
  onDrop,
  accept,
  maxSize,
  title = "Arraste arquivos aqui",
  description,
  className,
  children,
}: DropzoneProps) {
  const [isDragging, setIsDragging] = React.useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    onDrop?.(files);
  };

  const handleClick = () => {
    // Trigger file input
  };

  return (
    <div
      onClick={handleClick}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        "border-[1.5px] border-dashed border-border-strong rounded-lg p-8 text-center cursor-pointer transition-colors duration-240 hover:border-orange-500 hover:bg-orange-500/3",
        isDragging && "border-orange-500 bg-orange-500/3",
        className
      )}
    >
      {children || (
        <>
          <svg className="w-[30px] h-[30px] text-text-muted mx-auto mb-3" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" fill="none">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
            <path d="M17 8l-5-5-5 5M12 3v12" />
          </svg>
          <p className="text-[12.5px] text-text-secondary mb-1">{title}</p>
          {description && <span className="text-[11px] text-text-muted">{description}</span>}
        </>
      )}
    </div>
  );
}

// ============================================================

export interface SliderProps {
  value?: number;
  min?: number;
  max?: number;
  step?: number;
  onChange?: (value: number) => void;
  showLabels?: boolean;
  leftLabel?: string;
  rightLabel?: string;
  className?: string;
}

export function Slider({
  value = 50,
  min = 0,
  max = 100,
  step = 1,
  onChange,
  showLabels = true,
  leftLabel,
  rightLabel,
  className,
}: SliderProps) {
  const percentage = ((value - min) / (max - min)) * 100;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange?.(Number(e.target.value));
  };

  return (
    <div className={cn("py-1.5", className)}>
      <div className="relative h-[5px] bg-bg-surface-3 rounded-[3px] my-3">
        <div
          className="absolute left-0 top-0 h-full bg-gradient-to-r from-orange-500 to-orange-400 rounded-[3px]"
          style={{ width: `${percentage}%` }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={handleChange}
          className="absolute inset-0 w-full h-full opacity-0 cursor-grab"
        />
        <div
          className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white border-2 border-orange-500 shadow-[0_1px_4px_rgba(0,0,0,0.3)] pointer-events-none"
          style={{ left: `${percentage}%` }}
        />
      </div>
      {showLabels && (
        <div className="flex justify-between text-[11px] text-text-muted font-mono">
          <span>{leftLabel || min}</span>
          <span className="text-orange-400">{value}</span>
          <span>{rightLabel || max}</span>
        </div>
      )}
    </div>
  );
}

// ============================================================

export interface ComboboxOption {
  value: string;
  label: string;
}

export interface ComboboxProps {
  options: ComboboxOption[];
  selectedValue?: string;
  onSelect?: (option: ComboboxOption) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  className?: string;
}

export function Combobox({
  options,
  selectedValue,
  onSelect,
  placeholder = "Selecionar...",
  searchPlaceholder = "Buscar...",
  className,
}: ComboboxProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState("");

  const filteredOptions = options.filter((opt) =>
    opt.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedOption = options.find((opt) => opt.value === selectedValue);

  return (
    <div className={cn("relative", className)}>
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-[15px] h-[15px] text-text-muted pointer-events-none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="1.7"
          fill="none"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          type="text"
          value={isOpen ? searchTerm : selectedOption?.label || ""}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onBlur={() => setTimeout(() => setIsOpen(false), 200)}
          placeholder={selectedOption?.label || placeholder}
          className="bg-bg-surface-2 border border-border-soft rounded-md pl-9 pr-3.5 py-2.5 text-text-primary text-[13.5px] outline-none transition-colors duration-240 hover:border-border-strong focus:border-orange-500 focus:shadow-[0_0_0_3px_rgba(255,122,26,0.16)] w-full"
        />
      </div>
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-bg-surface-2 border border-border-soft rounded-md overflow-hidden shadow-[0_12px_28px_rgba(0,0,0,0.35)] z-10">
          {filteredOptions.map((option) => (
            <div
              key={option.value}
              onClick={() => {
                onSelect?.(option);
                setIsOpen(false);
                setSearchTerm("");
              }}
              className={cn(
                "px-3.5 py-2.5 text-[13px] flex items-center justify-between cursor-pointer transition-colors duration-140 hover:bg-bg-surface-3",
                option.value === selectedValue && "text-orange-400"
              )}
            >
              <span>{option.label}</span>
              {option.value === selectedValue && (
                <svg className="w-[14px] h-[14px]" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" fill="none">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================

export interface TagInputProps {
  tags: string[];
  onTagsChange: (tags: string[]) => void;
  placeholder?: string;
  className?: string;
}

export function TagInput({
  tags = [],
  onTagsChange,
  placeholder = "Adicionar tag...",
  className,
}: TagInputProps) {
  const [inputValue, setInputValue] = React.useState("");

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && inputValue.trim()) {
      e.preventDefault();
      if (!tags.includes(inputValue.trim())) {
        onTagsChange([...tags, inputValue.trim()]);
      }
      setInputValue("");
    } else if (e.key === "Backspace" && !inputValue && tags.length > 0) {
      onTagsChange(tags.slice(0, -1));
    }
  };

  const removeTag = (indexToRemove: number) => {
    onTagsChange(tags.filter((_, index) => index !== indexToRemove));
  };

  return (
    <div
      className={cn(
        "flex flex-wrap gap-1.5 items-center bg-bg-surface-2 border border-border-soft rounded-md px-2.5 py-2 transition-colors duration-240 focus-within:border-orange-500 focus-within:shadow-[0_0_0_3px_rgba(255,122,26,0.16)]",
        className
      )}
    >
      {tags.map((tag, index) => (
        <span
          key={index}
          className="flex items-center gap-1.5 bg-bg-surface-4 rounded-full px-2.5 py-1 text-[12px]"
        >
          {tag}
          <button
            onClick={() => removeTag(index)}
            className="w-[15px] h-[15px] rounded-full flex items-center justify-center text-text-muted transition-colors duration-140 hover:bg-red-500 hover:text-white"
          >
            <svg className="w-[10px] h-[10px]" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" fill="none">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </span>
      ))}
      <input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="border-none bg-transparent outline-none text-text-primary text-[13px] flex-1 min-w-[80px] font-body"
      />
    </div>
  );
}
