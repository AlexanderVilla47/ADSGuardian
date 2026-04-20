// Ads Modal - Live ads associated with a contract

import { useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/Dialog';
import { StatusBadge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { Button } from '@/components/ui/Button';
import { useAdsByContract } from '@/hooks/useContracts';
import { usePauseAd, useOperationStatus } from '@/hooks/useOperations';
import { AlertTriangle, Pause, CheckCircle, Info, LoaderCircle, Clock3, CircleAlert, Search } from 'lucide-react';
import type { Contract, Ad, PauseAdResponse } from '@/types/api';

// ============================================
// Mock data (shown when Meta API isn't configured)
// ============================================

const MOCK_ADS: Ad[] = [
  { ad_id: 'ad-demo-001', ad_name: 'Promo Verano 2026', ad_status: 'ACTIVE', campaign_name: 'Campaña Mayo' },
  { ad_id: 'ad-demo-002', ad_name: 'Story Producto X', ad_status: 'PAUSED', campaign_name: 'Campaña Mayo' },
  { ad_id: 'ad-demo-003', ad_name: 'Reel 15seg', ad_status: 'ACTIVE', campaign_name: 'Brand Always On' },
];

// ============================================
// Props
// ============================================

interface AdsModalProps {
  contract: Contract;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface PauseAllSummary {
  accepted: number;
  failed: number;
  total: number;
}

// ============================================
// Ad status badge helper
// ============================================

function AdStatusBadge({ status }: { status: Ad['ad_status'] }) {
  const map: Record<Ad['ad_status'], { variant: 'success' | 'neutral' | 'warning' | 'error'; label: string }> = {
    ACTIVE:   { variant: 'success', label: 'Activo' },
    PAUSED:   { variant: 'warning', label: 'Pausado' },
    DELETED:  { variant: 'error',   label: 'Eliminado' },
    ARCHIVED: { variant: 'neutral', label: 'Archivado' },
  };
  const { variant, label } = map[status] ?? { variant: 'neutral', label: status };
  return <StatusBadge variant={variant} label={label} />;
}

// ============================================
// Component
// ============================================

export default function AdsModal({ contract, open, onOpenChange }: AdsModalProps) {
  const { data, isLoading, isError, refetch } = useAdsByContract(contract.contract_id, open);
  const pauseAd = usePauseAd();
  const [pausingId, setPausingId] = useState<string | null>(null);
  const [pausingAll, setPausingAll] = useState(false);
  const [pauseAllConfirmOpen, setPauseAllConfirmOpen] = useState(false);
  const [pauseAllProgress, setPauseAllProgress] = useState({ done: 0, total: 0 });
  const [pauseAllSummary, setPauseAllSummary] = useState<PauseAllSummary | null>(null);
  const [search, setSearch] = useState('');
  const [lastPauseResponse, setLastPauseResponse] = useState<PauseAdResponse | null>(null);
  const [statusTrackingId, setStatusTrackingId] = useState<string | null>(null);

  const operationStatus = useOperationStatus(statusTrackingId, lastPauseResponse?.correlation_id, open && !isError);

  const isMockMode = isError;
  const allAds: Ad[] = isMockMode ? MOCK_ADS : (data?.data?.items ?? []);
  const ads = useMemo(() => {
    if (!search.trim()) return allAds;
    const q = search.toLowerCase();
    return allAds.filter(ad => ad.ad_name.toLowerCase().includes(q));
  }, [allAds, search]);

  const displayedStatus = useMemo(() => {
    const polled = operationStatus.data?.data;
    if (polled?.status) return polled.status;
    return lastPauseResponse?.status;
  }, [operationStatus.data, lastPauseResponse]);

  const handlePause = async (ad: Ad) => {
    if (isMockMode || pausingAll) return;
    setPauseAllSummary(null);
    setPausingId(ad.ad_id);
    try {
      const response = await pauseAd.mutateAsync({
        adId: ad.ad_id,
        data: {
          contract_id: contract.contract_id,
          reason: 'Manual pause from UI',
          requested_by: 'ops@adskiller',
        },
      });

      if (response.data) {
        setLastPauseResponse(response.data);
        setStatusTrackingId(response.data.tracking_id);
      }

      if (response.data?.status === 'paused' || response.data?.status === 'already_paused' || response.data?.status === 'failed') {
        refetch();
      }
    } finally {
      setPausingId(null);
    }
  };

  const activeAds = useMemo(() => allAds.filter(a => a.ad_status === 'ACTIVE'), [allAds]);

  const handlePauseAll = async () => {
    if (isMockMode || activeAds.length === 0 || pausingAll || (pausingId && !pausingAll)) return;
    setPauseAllConfirmOpen(false);
    setPausingAll(true);
    setPauseAllProgress({ done: 0, total: activeAds.length });
    setPauseAllSummary(null);
    setLastPauseResponse(null);
    setStatusTrackingId(null);

    let accepted = 0;
    let failed = 0;

    try {
      for (let i = 0; i < activeAds.length; i++) {
        const ad = activeAds[i];
        setPausingId(ad.ad_id);
        try {
          const response = await pauseAd.mutateAsync({
            adId: ad.ad_id,
            data: {
              contract_id: contract.contract_id,
              reason: 'Pause all from UI',
              requested_by: 'ops@adskiller',
            },
          });

          if (response.data?.status === 'failed') {
            failed += 1;
          } else {
            accepted += 1;
          }
        } catch {
          failed += 1;
          // continue with next ad
        }
        setPauseAllProgress({ done: i + 1, total: activeAds.length });
      }
    } finally {
      setPausingId(null);
      setPausingAll(false);
    }

    setPauseAllSummary({ accepted, failed, total: activeAds.length });
    refetch();
  };

  const isFinalStatus = displayedStatus === 'paused' || displayedStatus === 'already_paused' || displayedStatus === 'failed' || displayedStatus === 'not_found';
  const isSinglePauseInFlight = Boolean(pausingId) && !pausingAll;
  const disablePauseAllButton = isMockMode || activeAds.length === 0 || pausingAll || isSinglePauseInFlight || (!isFinalStatus && Boolean(statusTrackingId));

  const statusBanner = (() => {
    if (!lastPauseResponse && !operationStatus.data?.data) return null;

    if (displayedStatus === 'queued') {
      return {
        tone: 'info' as const,
        icon: <Clock3 className="h-4 w-4 mt-0.5 shrink-0" />,
        title: 'Solicitud en cola',
        message: 'La pausa fue aceptada. Estamos esperando ejecución en backend.',
      };
    }

    if (displayedStatus === 'processing') {
      return {
        tone: 'info' as const,
        icon: <LoaderCircle className="h-4 w-4 mt-0.5 shrink-0 animate-spin" />,
        title: 'Procesando pausa',
        message: 'El backend está ejecutando precheck/pausa. Todavía no hay estado final.',
      };
    }

    if (displayedStatus === 'paused' || displayedStatus === 'already_paused') {
      return {
        tone: 'success' as const,
        icon: <CheckCircle className="h-4 w-4 mt-0.5 shrink-0" />,
        title: displayedStatus === 'paused' ? 'Ad pausado' : 'Ad ya estaba pausado',
        message: 'Estado final confirmado por tracking.',
      };
    }

    return {
      tone: 'error' as const,
      icon: <CircleAlert className="h-4 w-4 mt-0.5 shrink-0" />,
      title: displayedStatus === 'not_found' ? 'Tracking no encontrado' : 'Falló la pausa',
      message: operationStatus.data?.data?.result?.error || 'No se pudo confirmar la pausa del ad.',
    };
  })();

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) setPauseAllConfirmOpen(false);
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[900px] w-full max-h-[90vh] flex flex-col overflow-hidden p-0">
        {/* Header fijo */}
        <div className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Ads — {contract.influencer_name}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Anuncios del contrato de {contract.influencer_name}
            </DialogDescription>
          </DialogHeader>
          <div className="relative mt-3">
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Buscar por nombre del ad..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => setPauseAllConfirmOpen(true)}
                disabled={disablePauseAllButton}
                className="gap-1.5 whitespace-nowrap"
              >
                <Pause className="h-3.5 w-3.5" />
                {pausingAll
                  ? `Pausando ${pauseAllProgress.done}/${pauseAllProgress.total}`
                  : `Pausar todos (${activeAds.length})`}
              </Button>
            </div>
            {pausingAll && (
              <p className="mt-2 text-xs text-muted-foreground">
                Progreso secuencial: {pauseAllProgress.done}/{pauseAllProgress.total}
              </p>
            )}
          </div>
        </div>

        {/* Cuerpo scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Mock mode banner */}
          {isMockMode && (
            <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">Meta API no configurada</p>
                <p className="text-amber-700 mt-0.5">
                  Estos son datos de ejemplo para verificar el formato. Una vez configuradas las credenciales, aparecerán los ads reales.
                </p>
              </div>
            </div>
          )}

          {statusBanner && (
            <div className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-sm ${
              statusBanner.tone === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : statusBanner.tone === 'error'
                  ? 'border-rose-200 bg-rose-50 text-rose-800'
                  : 'border-sky-200 bg-sky-50 text-sky-800'
            }`}>
              {statusBanner.icon}
              <div>
                <p className="font-medium">{statusBanner.title}</p>
                <p className="mt-0.5">{statusBanner.message}</p>
                <p className="mt-1 font-mono text-xs opacity-80">
                  tracking: {(operationStatus.data?.data?.tracking_id || lastPauseResponse?.tracking_id || 'N/A')} · corr: {(operationStatus.data?.data?.correlation_id || lastPauseResponse?.correlation_id || 'N/A')}
                </p>
              </div>
            </div>
          )}

          {pauseAllSummary && (
            <div className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-sm ${
              pauseAllSummary.failed === 0
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-amber-200 bg-amber-50 text-amber-800'
            }`}>
              {pauseAllSummary.failed === 0
                ? <CheckCircle className="h-4 w-4 mt-0.5 shrink-0" />
                : <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />}
              <div>
                <p className="font-medium">Resultado pausa masiva</p>
                <p className="mt-0.5">
                  Aceptadas: {pauseAllSummary.accepted} · Fallidas: {pauseAllSummary.failed} · Total: {pauseAllSummary.total}
                </p>
              </div>
            </div>
          )}

          {/* Loading state */}
          {isLoading && (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          )}

          {/* Ads list */}
          {!isLoading && ads.length > 0 && (
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm table-fixed">
                <colgroup>
                  <col className="w-[45%]" />
                  <col className="w-[25%]" />
                  <col className="w-[15%]" />
                  <col className="w-[15%]" />
                </colgroup>
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Ad</th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Campaña</th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Estado</th>
                    <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {ads.map((ad) => (
                    <tr key={ad.ad_id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium truncate" title={ad.ad_name}>{ad.ad_name}</p>
                        <p className="text-xs text-muted-foreground font-mono">{ad.ad_id}</p>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground truncate">
                        {ad.campaign_name ?? '-'}
                      </td>
                      <td className="px-4 py-3">
                        <AdStatusBadge status={ad.ad_status} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        {ad.ad_status === 'ACTIVE' ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handlePause(ad)}
                            disabled={isMockMode || pausingAll || pausingId === ad.ad_id || !isFinalStatus && Boolean(statusTrackingId)}
                            className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/5 whitespace-nowrap"
                          >
                            <Pause className="h-3 w-3" />
                            {pausingId === ad.ad_id ? 'Pausando...' : 'Pausar'}
                          </Button>
                        ) : (
                          <CheckCircle className="h-4 w-4 text-muted-foreground ml-auto" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Empty state */}
          {!isLoading && !isError && ads.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground gap-2">
              <Info className="h-8 w-8" />
              <p className="font-medium">Sin ads encontrados</p>
              <p className="text-sm">No se encontraron ads activos para el patrón <span className="font-mono">{contract.ad_match_pattern}</span></p>
            </div>
          )}
        </div>

        {/* Footer fijo */}
        {!isLoading && ads.length > 0 && (
          <div className="px-6 py-3 border-t shrink-0">
            <p className="text-xs text-muted-foreground text-right">
              {ads.filter(a => a.ad_status === 'ACTIVE').length} activos · {ads.length}{search.trim() ? ` de ${allAds.length}` : ''} total
              {isMockMode && ' (demo)'}
            </p>
          </div>
        )}
      </DialogContent>

      <Dialog open={pauseAllConfirmOpen} onOpenChange={setPauseAllConfirmOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Confirmar pausa masiva</DialogTitle>
            <DialogDescription>
              Se pausarán {activeAds.length} ads activos en este contrato. Esta acción solicitará pausas secuenciales.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPauseAllConfirmOpen(false)}
              disabled={pausingAll}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handlePauseAll}
              disabled={pausingAll || activeAds.length === 0}
            >
              Confirmar pausa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
