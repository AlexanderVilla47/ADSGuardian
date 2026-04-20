// View Contract Modal - Detailed view of a contract

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { StatusBadge } from '@/components/ui/Badge';
import type { Contract } from '@/types/api';
import { formatDateDisplay, getTimezoneLabel } from '@/lib/utils/date';

// ============================================
// Props
// ============================================

interface ViewContractModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contract: Contract;
}

// ============================================
// Component
// ============================================

export default function ViewContractModal({ 
  open, 
  onOpenChange, 
  contract 
}: ViewContractModalProps) {
  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'Activo':
        return 'success';
      case 'Finalizado':
        return 'neutral';
      default:
        return 'neutral';
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Detalles del Contrato</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">{contract.contract_id}</h3>
              <p className="text-muted-foreground">{contract.influencer_name}</p>
            </div>
            <StatusBadge 
              variant={getStatusVariant(contract.contract_status)} 
              label={contract.contract_status} 
            />
          </div>
          
          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Patrón de Matching de Anuncio</p>
              <p className="font-mono text-sm">{contract.ad_match_pattern}</p>
            </div>
            
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">ID del Anuncio</p>
              <p className="font-mono text-sm">{contract.ad_id || '-'}</p>
            </div>
            
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Nombre del Anuncio</p>
              <p className="text-sm">{contract.ad_name || '-'}</p>
            </div>
            
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Canal de Notificación</p>
              <p className="text-sm">{contract.notification_channel || '-'}</p>
            </div>
            
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Fecha de Inicio</p>
              <p className="text-sm">{formatDateDisplay(contract.start_date)}</p>
            </div>
            
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Fecha de Fin</p>
              <p className="text-sm">{formatDateDisplay(contract.end_date)}</p>
            </div>
            
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Notificación Preventiva</p>
              <p className="text-sm">{contract.notified_preventive ? 'Enviada' : 'No enviada'}</p>
            </div>
            
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Última Verificación</p>
              <p className="text-sm">
                {contract.last_check 
                  ? new Date(contract.last_check).toLocaleString('es-AR')
                  : '-'}
              </p>
            </div>
          </div>
          
          {/* Timezone */}
          <div className="pt-4 border-t">
            <p className="text-xs text-muted-foreground">
              Timezone: {getTimezoneLabel()}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}