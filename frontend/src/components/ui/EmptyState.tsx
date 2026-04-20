import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "./Button";
import { Inbox } from "lucide-react";

export interface EmptyStateProps {
  message: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  icon?: React.ReactNode;
  className?: string;
}

function EmptyState({ message, action, icon, className }: EmptyStateProps) {
  return (
    <div className={cn(
      "flex flex-col items-center justify-center py-12 px-4 text-center",
      className
    )}>
      <div className="rounded-full bg-muted p-4 mb-4">
        {icon || <Inbox className="h-8 w-8 text-muted-foreground" />}
      </div>
      <p className="text-sm text-muted-foreground mb-4 max-w-sm">
        {message}
      </p>
      {action && (
        <Button onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}

export { EmptyState };