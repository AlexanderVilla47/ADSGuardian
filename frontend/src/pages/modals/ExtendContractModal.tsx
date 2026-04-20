// Extend Contract Modal - Form for extending a contract

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
import { validateDateFormat, validateNewEndDate } from '@/lib/utils/date';
import type { Contract } from '@/types/api';

// ============================================
// Validation Schema
// ============================================

const extendContractSchema = z.object({
  new_end_date: z.string().min(1, 'New end date is required').refine(
    (val) => validateDateFormat(val),
    { message: 'Use YYYY-MM-DD format' }
  ),
  reason: z.string().optional(),
});

type ExtendContractFormData = z.infer<typeof extendContractSchema>;

// ============================================
// Props
// ============================================

interface ExtendContractModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contract: Contract;
  onSubmit: (newEndDate: string, reason?: string) => Promise<void>;
  isLoading?: boolean;
}

// ============================================
// Component
// ============================================

export default function ExtendContractModal({ 
  open, 
  onOpenChange, 
  contract,
  onSubmit,
  isLoading = false 
}: ExtendContractModalProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
    reset,
  } = useForm<ExtendContractFormData>();
  
  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      reset();
    }
    onOpenChange(isOpen);
  };
  
  const onFormSubmit = async (data: ExtendContractFormData) => {
    // Validate new_end_date > current end_date
    if (!validateNewEndDate(contract.end_date, data.new_end_date)) {
      setError('new_end_date', {
        message: 'New end date must be later than current end date',
      });
      return;
    }
    
    await onSubmit(data.new_end_date, data.reason);
    reset();
  };
  
  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Extender Contrato</DialogTitle>
          <DialogDescription>
            Extender el contrato de {contract.influencer_name} (ID: {contract.contract_id})
          </DialogDescription>
        </DialogHeader>
        
        {/* Current contract info */}
        <div className="bg-muted rounded-lg p-4 space-y-2">
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Fecha Fin Actual:</span>
            <span className="text-sm font-medium">{contract.end_date}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Estado:</span>
            <span className="text-sm font-medium">{contract.contract_status}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Notificación Preventiva:</span>
            <span className="text-sm font-medium">
              {contract.notified_preventive ? 'Sí' : 'No'}
            </span>
          </div>
        </div>
        
        <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
          {/* New End Date */}
          <div className="space-y-2">
            <Label htmlFor="new_end_date">Nueva Fecha de Fin *</Label>
            <Input
              id="new_end_date"
              type="date"
              min={contract.end_date}
              {...register('new_end_date')}
            />
            {errors.new_end_date && (
              <p className="text-sm text-red-600">{errors.new_end_date.message}</p>
            )}
          </div>
          
          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="reason">Motivo (opcional)</Label>
            <Input
              id="reason"
              placeholder="Renovación comercial"
              {...register('reason')}
            />
          </div>
          
          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => handleClose(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Extendiendo...' : 'Extender Contrato'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}