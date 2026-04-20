import { cn } from "@/lib/utils";
import { Eye, Pause, MoreHorizontal, LayoutList, Clock } from "lucide-react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";

// ============================================
// Icons map
// ============================================

const iconMap: Record<string, React.ComponentType<{ className?: string }> | null> = {
  view: Eye,
  extend: Clock,
  pause: Pause,
  more: MoreHorizontal,
  ads: LayoutList,
};

type IconType = 'view' | 'extend' | 'pause' | 'more' | 'ads';

// ============================================
// Inline Action Icon Props
// ============================================

export interface InlineActionIconProps {
  type: IconType;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  variant?: 'default' | 'destructive';
}

// ============================================
// Inline Action Icon Component
// ============================================

function InlineActionIcon({
  type,
  label,
  onClick,
  disabled = false,
  className,
  variant = 'default',
}: InlineActionIconProps) {
  const IconComponent = iconMap[type];
  
  return (
    <TooltipPrimitive.Provider delayDuration={300}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>
          <button
            onClick={onClick}
            disabled={disabled}
            className={cn(
              "inline-flex items-center justify-center rounded-md p-2 text-sm font-medium transition-colors",
              "text-[#6B4F8C] hover:bg-[#E8DEFF]",
              "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
              "disabled:pointer-events-none disabled:opacity-50",
              variant === 'destructive' && "text-red-600 hover:bg-red-100",
              className
            )}
          >
            {IconComponent && <IconComponent className="h-4 w-4" />}
            <span className="sr-only">{label}</span>
          </button>
        </TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            className={cn(
              "z-50 overflow-hidden rounded-md border bg-popover px-3 py-1.5 text-sm shadow-md",
              "animate-in fade-in-0 zoom-in-95",
              "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
            )}
            sideOffset={5}
          >
            {label}
            <TooltipPrimitive.Arrow className="fill-popover" />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}

// Alias for action types
export type ActionType = IconType;

export { InlineActionIcon };