import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// ============================================
// Status Badge Variants
// ============================================

const statusBadgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        success: "border-transparent bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
        warning: "border-transparent bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100",
        error: "border-transparent bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100",
        neutral: "border-transparent bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100",
        info: "border-transparent bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  }
);

export interface StatusBadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof statusBadgeVariants> {
  label?: string;
}

function StatusBadge({ className, variant, label, ...props }: StatusBadgeProps) {
  return (
    <div className={cn(statusBadgeVariants({ variant }), className)} {...props}>
      {label?.toUpperCase() || ''}
    </div>
  );
}

// ============================================
// Severity Badge Variants
// ============================================

const severityBadgeVariants = cva(
  "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        critical: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100",
        warn: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100",
        info: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100",
      },
    },
    defaultVariants: {
      variant: "info",
    },
  }
);

export interface SeverityBadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof severityBadgeVariants> {
  label?: string;
}

function SeverityBadge({ className, variant, label, ...props }: SeverityBadgeProps) {
  const labels = {
    critical: 'CRITICAL',
    warn: 'WARNING',
    info: 'INFO',
  };
  
  return (
    <div className={cn(severityBadgeVariants({ variant }), className)} {...props}>
      {label || labels[variant || 'info']}
    </div>
  );
}

export { StatusBadge, statusBadgeVariants, SeverityBadge, severityBadgeVariants };