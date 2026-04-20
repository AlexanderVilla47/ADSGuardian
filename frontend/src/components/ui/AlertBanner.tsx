import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { AlertCircle, Info, XCircle } from "lucide-react";

const alertVariants = cva(
  "relative w-full rounded-lg border p-4 [&>svg~*]:pl-14 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground",
  {
    variants: {
      variant: {
        info: "bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-200",
        warning: "bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-950 dark:border-yellow-800 dark:text-yellow-200",
        error: "bg-red-50 border-red-200 text-red-800 dark:bg-red-950 dark:border-red-800 dark:text-red-200",
      },
    },
    defaultVariants: {
      variant: "info",
    },
  }
);

const alertIcons = {
  info: Info,
  warning: AlertCircle,
  error: XCircle,
};

export interface AlertBannerProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {
  title?: string;
  message: string;
}

function AlertBanner({ className, variant, title, message, ...props }: AlertBannerProps) {
  const Icon = alertIcons[variant || 'info'];
  
  return (
    <div className={cn(alertVariants({ variant }), className)} {...props}>
      <Icon className="h-4 w-4" />
      {title && (
        <h5 className="mb-1 font-medium leading-none tracking-tight">
          {title}
        </h5>
      )}
      <div className="text-sm [&_p]:leading-relaxed">
        {message}
      </div>
    </div>
  );
}

export { AlertBanner, alertVariants };