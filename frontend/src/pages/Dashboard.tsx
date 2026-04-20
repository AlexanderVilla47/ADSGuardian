// Dashboard Page - Operational health and risk queue

import { useRiskQueue, useRunNow } from '@/hooks/useOperations';
import { useContracts } from '@/hooks/useContracts';
import { KpiCard } from '@/components/domain/KpiCard';
import { StatusBadge } from '@/components/ui/Badge';
import { InlineActionIcon } from '@/components/domain/InlineActionIcon';
import { Skeleton } from '@/components/ui/Skeleton';
import { Button } from '@/components/ui/Button';
import { Play, CheckCircle, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { RiskQueueItem } from '@/types/api';

function parseYmdToUtcMs(ymd: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || '').trim());
  if (!m) return null;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function getTodayInBuenosAires(): string {
  const now = new Date();
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

function getDaysToEnd(endDate: string): number {
  const endMs = parseYmdToUtcMs(endDate);
  const todayMs = parseYmdToUtcMs(getTodayInBuenosAires());
  if (endMs === null || todayMs === null) return 999;
  return Math.round((endMs - todayMs) / 86400000);
}

function getSeverityFromDays(daysToEnd: number): RiskQueueItem['severity'] {
  if (daysToEnd < 0) return 'critical';
  if (daysToEnd <= 1) return 'warn'; // <48h (hoy o manana)
  return 'info';
}

function getSeverityBadge(severity: RiskQueueItem['severity']): { variant: 'error' | 'warning' | 'info'; label: string } {
  if (severity === 'critical') return { variant: 'error', label: 'CRITICO' };
  if (severity === 'warn') return { variant: 'warning', label: 'PREVENTIVO' };
  return { variant: 'info', label: 'INFORMATIVO' };
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const {
    data: riskData,
    isLoading,
    isFetching: isFetchingRisk,
    refetch: refetchRiskQueue,
  } = useRiskQueue();

  const {
    data: allContractsData,
    isFetching: isFetchingContracts,
    refetch: refetchContracts,
  } = useContracts();

  const runNow = useRunNow();

  const riskItems = riskData?.data?.items || [];
  const activeRiskItems = riskItems.filter((item) => item.contract_status === 'Activo');
  const riskItemsWithSeverity = activeRiskItems.map((item) => {
    const daysToEnd = getDaysToEnd(item.end_date);
    const severity = getSeverityFromDays(daysToEnd);
    return { ...item, daysToEnd, severity };
  });

  const totalContracts = allContractsData?.data?.total ?? 0;
  const activeContracts = allContractsData?.data?.total_active ?? 0;
  const expiringUnder48h = riskItemsWithSeverity.filter((r) => r.severity === 'warn').length;
  const expiredUnpaused = riskItemsWithSeverity.filter((r) => r.severity === 'critical').length;
  const isRefreshing = isFetchingRisk || isFetchingContracts;

  const handleRunNow = () => {
    runNow.mutate({ run_mode: 'manual', requested_by: 'dashboard' });
  };

  const handleRefresh = async () => {
    await Promise.all([refetchRiskQueue(), refetchContracts()]);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="mb-2 h-9 w-48" />
            <Skeleton className="h-5 w-72" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Panel de Control</h1>
          <p className="text-muted-foreground">Monitorea la salud operativa e interviene en riesgos</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleRefresh} disabled={isRefreshing}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Actualizando...' : 'Refrescar'}
          </Button>
          <Button onClick={handleRunNow} disabled={runNow.isPending}>
            <Play className="mr-2 h-4 w-4" />
            {runNow.isPending ? 'Ejecutando...' : 'Ejecutar ahora'}
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <KpiCard title="Total Contratos" value={totalContracts} variant="neutral" />
        <KpiCard title="Activos" value={activeContracts} variant="neutral" />
        <KpiCard
          title="Proximos a Vencer (<48hs)"
          value={expiringUnder48h}
          variant={expiringUnder48h > 0 ? 'warning' : 'neutral'}
        />
        <KpiCard
          title="Vencidos sin Pausar"
          value={expiredUnpaused}
          variant={expiredUnpaused > 0 ? 'critical' : 'neutral'}
        />
      </div>

      {/* Risk Table */}
      {riskItemsWithSeverity.length > 0 ? (
        <div className="rounded-md border">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium">Influencer</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Fecha Fin</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Estado</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Severidad</th>
                  <th className="px-4 py-3 text-center text-sm font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {riskItemsWithSeverity.map((item) => {
                  const severityBadge = getSeverityBadge(item.severity);
                  return (
                    <tr key={item.contract_id} className="border-b hover:bg-muted/50">
                      <td className="px-4 py-3">{item.influencer_name}</td>
                      <td className="px-4 py-3">{item.end_date}</td>
                      <td className="px-4 py-3">
                        <StatusBadge variant={item.contract_status === 'Activo' ? 'success' : 'neutral'} label={item.contract_status} />
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge variant={severityBadge.variant} label={severityBadge.label} />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <InlineActionIcon
                            type="extend"
                            label="Extender contrato"
                            onClick={() => navigate(`/contracts?contract=${item.contract_id}&action=extend`)}
                            disabled={item.contract_status === 'Finalizado'}
                          />
                          <InlineActionIcon
                            type="pause"
                            label="Finalizar contrato"
                            variant="destructive"
                            onClick={() => navigate(`/contracts?contract=${item.contract_id}&action=finalize`)}
                            disabled={item.contract_status === 'Finalizado'}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="py-12 text-center text-muted-foreground">
          <CheckCircle className="mx-auto mb-4 h-12 w-12 text-green-500" />
          <p className="text-lg font-medium">No se detectaron riesgos para hoy</p>
          <p className="text-sm">Todos los contratos estan operando normalmente</p>
        </div>
      )}
    </div>
  );
}