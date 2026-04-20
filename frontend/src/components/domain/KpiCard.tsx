import { Card, CardContent, CardHeader, CardTitle } from "../ui/Card";
import { StatusBadge } from "../ui/Badge";
import { cn } from "@/lib/utils";

// ============================================
// KPI Card - Domain Component
// ============================================

export type KpiVariant = 'neutral' | 'warning' | 'critical';

export interface KpiCardProps {
  title: string;
  value: string | number;
  variant?: KpiVariant;
  subtitle?: string;
  trend?: {
    value: number;
    direction: 'up' | 'down' | 'neutral';
  };
  className?: string;
}

function KpiCard({ title, value, variant = 'neutral', subtitle, trend, className }: KpiCardProps) {
  const getStatusVariant = () => {
    switch (variant) {
      case 'warning':
        return 'warning';
      case 'critical':
        return 'error';
      default:
        return 'neutral';
    }
  };

  const getBadgeLabel = () => {
    switch (variant) {
      case 'warning':
        return 'ALERTA';
      case 'critical':
        return 'CRITICO';
      default:
        return '';
    }
  };
  
  return (
    <Card className={cn("min-w-[200px]", className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {title}
          </CardTitle>
          {variant !== 'neutral' && (
            <StatusBadge variant={getStatusVariant()} label={getBadgeLabel()} />
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">{value}</div>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        )}
        {trend && (
          <div className={cn(
            "text-xs mt-2",
            trend.direction === 'up' && "text-green-600",
            trend.direction === 'down' && "text-red-600",
            trend.direction === 'neutral' && "text-muted-foreground"
          )}>
            {trend.direction === 'up' && '↑ '}
            {trend.direction === 'down' && '↓ '}
            {trend.value}% vs anterior
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export { KpiCard };
