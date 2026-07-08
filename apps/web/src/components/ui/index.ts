// ============================================================
// Helion CRM — Componentes Estendidos
// Exportações do Design System
// ============================================================

// 01 — Funis de Venda
export {
  GeometricFunnel,
  VerticalFunnel,
  MiniFunnel,
  type GeometricFunnelProps,
  type VerticalFunnelProps,
  type MiniFunnelProps,
} from "./funnels";

// 02 — Cards de Trabalho
export {
  ContactCard,
  ProposalCard,
  TaskCard,
  NotificationCard,
  EmptyState,
  IntegrationCard,
  ComparisonCard,
  type ContactCardProps,
  type ProposalCardProps,
  type ProposalStatus,
  type TaskCardProps,
  type TaskPriority,
  type NotificationCardProps,
  type NotificationType,
  type EmptyStateProps,
  type IntegrationCardProps,
  type ComparisonCardProps,
} from "./cards";

// 03 — Métricas Complementares
export {
  SparklineRow,
  VerticalBarChart,
  ActivityHeatmap,
  Gauge,
  MonthComparison,
  type SparklineRowProps,
  type VerticalBarChartProps,
  type ActivityHeatmapProps,
  type GaugeProps,
  type MonthComparisonProps,
} from "./metrics";

// 04 — Formulários
export {
  Textarea,
  InputWithIcon,
  InlineValidation,
  Checkbox,
  Radio,
  DatePicker,
  Dropzone,
  Slider,
  Combobox,
  TagInput,
  type TextareaProps,
  type InputWithIconProps,
  type InlineValidationProps,
  type CheckboxProps,
  type RadioProps,
  type DatePickerProps,
  type DropzoneProps,
  type SliderProps,
  type ComboboxOption,
  type ComboboxProps,
  type TagInputProps,
} from "./forms";

// 05 — Navegação
export {
  Breadcrumb,
  Tabs,
  Pagination,
  ContextMenu,
  Dropdown,
  CommandPalette,
  type BreadcrumbItem,
  type BreadcrumbProps,
  type Tab,
  type TabsProps,
  type PaginationProps,
  type ContextMenuItem,
  type ContextMenuProps,
  type DropdownItem,
  type DropdownProps,
  type CommandPaletteItem,
  type CommandPaletteProps,
} from "./navigation";

// 06 — Overlays & Feedback
export {
  Modal,
  Toast,
  ToastContainer,
  Tooltip,
  Popover,
  Skeleton,
  AlertBanner,
  type ModalProps,
  type ToastType,
  type ToastProps,
  type ToastContainerProps,
  type TooltipProps,
  type PopoverProps,
  type SkeletonProps,
  type AlertBannerProps,
} from "./overlays";
