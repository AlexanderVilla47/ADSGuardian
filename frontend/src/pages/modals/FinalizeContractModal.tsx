// Finalize Contract Modal - Form for manually finalizing a contract

import { useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import type { Contract } from '@/types/api';

// ============================================
// Validation Schema
// ============================================

const finalizeContractSchema = z.object({
  reason: z.string().min(1, 'Reason is required'),
});

type FinalizeContractFormData = z.infer<typeof finalizeContractSchema>;

// ============================================
// Props
// ============================================

interface FinalizeContractModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contract: Contract;
  onSubmit: (reason: string) => Promise<void>;
  isLoading?: boolean;
}

// ============================================
// Component
// ============================================

export default function FinalizeContractModal({ 
  open, 
  onOpenChange, 
  contract,
  onSubmit,
  isLoading = false 
}: FinalizeContractModalProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<FinalizeContractFormData>();
  
  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      reset();
    }
    onOpenChange(isOpen);
  };
  
  const onFormSubmit = async (data: FinalizeContractFormData) => {
    await onSubmit(data.reason);
    reset();
  };
  
  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Finalizar Contrato</DialogTitle>
          <DialogDescription>
            Finalizar manualmente el contrato de {contract.influencer_name} (ID: {contract.contract_id})
          </DialogDescription>
        </DialogHeader>
        
        {/* Warning */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm text-yellow-800">
            <strong>Advertencia:</strong> Esta acción marcará el contrato como finalizado y 
            pausará cualquier anuncio asociado. No se puede deshacer.
          </p>
        </div>
        
        {/* Current contract info */}
        <div className="bg-muted rounded-lg p-4 space-y-2">
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Estado Actual:</span>
            <span className="text-sm font-medium">{contract.contract_status}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Fecha Fin:</span>
            <span className="text-sm font-medium">{contract.end_date}</span>
          </div>
        </div>
        
        <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="reason">Motivo *</Label>
            <Input
              id="reason"
              placeholder="Cierre manual por operación"
              {...register('reason')}
            />
            {errors.reason && (
              <p className="text-sm text-red-600">{errors.reason.message}</p>
            )}
          </div>
          
          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => handleClose(false)}
            >
              Cancelar
            </Button>
            <Button 
              type="submit" 
              variant="destructive"
              disabled={isLoading}
            >
              {isLoading ? 'Finalizando...' : 'Finalizar Contrato'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}