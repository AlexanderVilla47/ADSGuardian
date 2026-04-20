import { useState } from 'react';
import { useAlertsHistory, useHistory } from '@/hooks/useOperations';
import { StatusBadge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { Button } from '@/components/ui/Button';
import { RefreshCw, Filter, ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ExecutionRow {
  date_time: string;
  trigger_type: 'Scheduler' | 'Manual';
  result: 'SUCCESS' | 'PARTIAL_FAILURE' | 'FAILED' | 'NOT_EXERCISED';
  contracts_evaluated: number;
  ads_paused: number;
  expired_found: number;
  errors: number;
  execution_id: string;
  correlation_id: string;
}

interface AlertRow {
  alert_id: string;
  severity: string;
  message: string;
  status: string;
  created_at: string;
}

export default function HistoryPage() {
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const [alertsPage, setAlertsPage] = useState(1);
  const alertsPageSize = 10;
  const [filter, setFilter] = useState<'all' | 'SUCCESS' | 'PARTIAL_FAILURE' | 'FAILED'>('all');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const { data, isLoading, refetch } = useHistory({
    page,
    page_size: pageSize,
    result: filter === 'all' ? undefined : filter,
  });
  const {
    data: alertsData,
    isLoading: isAlertsLoading,
    isError: isAlertsError,
    refetch: refetchAlerts,
  } = useAlertsHistory({
    page: alertsPage,
    page_size: alertsPageSize,
  });

  const executions: ExecutionRow[] = (data?.data?.items || []).map(op => ({
    date_time:            op.executed_at || '—',
    trigger_type:         op.run_mode === 'manual' ? 'Manual' : 'Scheduler',
    result:               op.result,
    contracts_evaluated:  op.contracts_evaluated,
    ads_paused:           op.ads_paused,
    expired_found:        op.expired_found,
    errors:               op.errors,
    execution_id:         op.execution_id,
    correlation_id:       op.correlation_id,
  }));

  const total = data?.data?.total || 0;
  const alertsTotal = alertsData?.data?.total || 0;
  const alerts: AlertRow[] = (alertsData?.data?.items || []).map((alert) => ({
    alert_id: alert.alert_id || '',
    severity: alert.severity || 'INFO',
    message: alert.message || '—',
    status: alert.status || '—',
    created_at: alert.created_at || '—',
  }));

  const handleRefresh = () => {
    void refetch();
    void refetchAlerts();
  };

  const toggleRow = (id: string) => {
    setExpandedRow(prev => (prev === id ? null : id));
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-9 w-64 mb-2" />
            <Skeleton className="h-5 w-80" />
          </div>
          <Skeleton className="h-10 w-32" />
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
          <h1 className="text-3xl font-bold tracking-tight">Historial Operativo</h1>
          <p className="text-muted-foreground">
            Auditoría de ejecuciones del kill-switch — programadas y manuales
          </p>
        </div>
        <Button variant="outline" onClick={handleRefresh} disabled={isLoading}>
          <RefreshCw className={cn('mr-2 h-4 w-4', isLoading && 'animate-spin')} />
          {isLoading ? 'Actualizando...' : 'Refrescar'}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <select
            className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={filter}
            onChange={(e) => { setFilter(e.target.value as typeof filter); setPage(1); }}
          >
            <option value="all">Todos</option>
            <option value="SUCCESS">Exitosos</option>
            <option value="PARTIAL_FAILURE">Parciales</option>
            <option value="FAILED">Fallidos</option>
          </select>
        </div>
        <span className="text-sm text-muted-foreground">{total} ejecuciones</span>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="w-8 px-3 py-3" />
                <th className="px-4 py-3 text-left text-sm font-medium">Fecha/Hora</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Origen</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Resultado</th>
                <th className="px-4 py-3 text-center text-sm font-medium">Evaluados</th>
                <th className="px-4 py-3 text-center text-sm font-medium">Pausados</th>
                <th className="px-4 py-3 text-center text-sm font-medium">Vencidos</th>
                <th className="px-4 py-3 text-center text-sm font-medium">Errores</th>
              </tr>
            </thead>
            <tbody>
              {executions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground text-sm">
                    No hay ejecuciones registradas.
                  </td>
                </tr>
              ) : (
                executions.map((row) => {
                  const isExpanded = expandedRow === row.execution_id;
                  const resultVariant =
                    row.result === 'SUCCESS' ? 'success' :
                    row.result === 'PARTIAL_FAILURE' ? 'warning' : 'error';

                  return (
                    <>
                      <tr
                        key={row.execution_id}
                        className="border-b hover:bg-muted/30 cursor-pointer"
                        onClick={() => toggleRow(row.execution_id)}
                      >
                        <td className="px-3 py-3 text-muted-foreground">
                          {isExpanded
                            ? <ChevronDown className="w-4 h-4" />
                            : <ChevronRight className="w-4 h-4" />}
                        </td>
                        <td className="px-4 py-3 text-sm">{row.date_time || '—'}</td>
                        <td className="px-4 py-3">
                          <span className={cn(
                            'px-2 py-0.5 rounded text-xs font-medium',
                            row.trigger_type === 'Manual'
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
                              : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                          )}>
                            {row.trigger_type === 'Manual' ? 'Manual' : 'Programado'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge variant={resultVariant} label={
                            row.result === 'SUCCESS' ? 'Exitoso' :
                            row.result === 'PARTIAL_FAILURE' ? 'Parcial' :
                            row.result === 'FAILED' ? 'Fallido' :
                            row.result === 'NOT_EXERCISED' ? 'Sin acción' : row.result
                          } />
                        </td>
                        <td className="px-4 py-3 text-center text-sm">{row.contracts_evaluated}</td>
                        <td className="px-4 py-3 text-center text-sm">{row.ads_paused}</td>
                        <td className="px-4 py-3 text-center text-sm">{row.expired_found}</td>
                        <td className={cn(
                          'px-4 py-3 text-center text-sm',
                          row.errors > 0 ? 'text-red-600 font-medium' : ''
                        )}>
                          {row.errors}
                        </td>
                      </tr>

                      {/* Fila expandida */}
                      {isExpanded && (
                        <tr key={`${row.execution_id}-detail`} className="bg-muted/20 border-b">
                          <td />
                          <td colSpan={7} className="px-4 py-3">
                            <div className="flex flex-wrap gap-6 text-sm text-muted-foreground">
                              <span>
                                <span className="font-medium text-foreground">ID Ejecución:</span>{' '}
                                <span className="font-mono">{row.execution_id || '—'}</span>
                              </span>
                              <span>
                                <span className="font-medium text-foreground">ID Correlación:</span>{' '}
                                <span className="font-mono">{row.correlation_id || '—'}</span>
                              </span>
                              <span>
                                <span className="font-medium text-foreground">Contratos evaluados:</span>{' '}
                                {row.contracts_evaluated}
                              </span>
                              <span>
                                <span className="font-medium text-foreground">Ads pausados:</span>{' '}
                                {row.ads_paused}
                              </span>
                              <span>
                                <span className="font-medium text-foreground">Vencidos encontrados:</span>{' '}
                                {row.expired_found}
                              </span>
                              <span>
                                <span className="font-medium text-foreground">Errores:</span>{' '}
                                {row.errors}
                              </span>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {total > pageSize && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Página {page} · {total} ejecuciones
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page * pageSize >= total}
              onClick={() => setPage(p => p + 1)}
            >
              Siguiente
            </Button>
          </div>
        </div>
      )}

      {/* Alerts table */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold tracking-tight">Alertas</h2>
          <span className="text-sm text-muted-foreground">{alertsTotal} alertas</span>
        </div>

        <div className="rounded-md border">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium">Fecha/Hora</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Severidad</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Motivo</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {isAlertsLoading ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8">
                      <Skeleton className="h-6 w-full" />
                    </td>
                  </tr>
                ) : isAlertsError ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-12 text-center text-sm text-red-600">
                      Error al cargar alertas.
                    </td>
                  </tr>
                ) : alerts.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-12 text-center text-muted-foreground text-sm">
                      No hay alertas registradas.
                    </td>
                  </tr>
                ) : (
                  alerts.map((row) => {
                    const severity = String(row.severity || '').toUpperCase();
                    const severityVariant =
                      severity === 'CRITICAL' ? 'error' :
                      severity === 'WARN' ? 'warning' :
                      'success';

                    return (
                      <tr key={row.alert_id || `${row.created_at}-${row.message}`} className="border-b hover:bg-muted/30">
                        <td className="px-4 py-3 text-sm">{row.created_at || '-'}</td>
                        <td className="px-4 py-3">
                          <StatusBadge variant={severityVariant} label={severity || 'INFO'} />
                        </td>
                        <td className="px-4 py-3 text-sm">{row.message || '-'}</td>
                        <td className="px-4 py-3 text-sm">{row.status || '-'}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {alertsTotal > alertsPageSize && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Pagina {alertsPage} · {alertsTotal} alertas
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={alertsPage === 1}
                onClick={() => setAlertsPage((prev) => prev - 1)}
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={alertsPage * alertsPageSize >= alertsTotal}
                onClick={() => setAlertsPage((prev) => prev + 1)}
              >
                Siguiente
              </Button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
