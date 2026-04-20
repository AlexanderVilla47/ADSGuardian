// New Contract Modal - Formulario simplificado para crear contratos
// Solo requiere nombre del influencer y fecha fin.
// F1 auto-genera Contrato_ID y Regex_Anuncio.

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
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
import { AlertBanner } from '@/components/ui/AlertBanner';
import { validateDateFormat } from '@/lib/utils/date';
import { useContracts } from '@/hooks/useContracts';

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z
  .object({
    influencer_name: z.string().min(1, 'El nombre del influencer es requerido'),
    end_date: z
      .string()
      .min(1, 'La fecha de fin es requerida')
      .refine(validateDateFormat, { message: 'Formato requerido: YYYY-MM-DD' }),
  })
  .refine(
    (data) => new Date(data.end_date + 'T00:00:00Z') > new Date(),
    { message: 'La fecha de fin debe ser futura', path: ['end_date'] }
  );

type FormData = z.infer<typeof schema>;

// ─── Props ────────────────────────────────────────────────────────────────────

interface NewContractModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { influencer_name: string; end_date: string }) => Promise<void>;
  isLoading?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function NewContractModal({
  open,
  onOpenChange,
  onSubmit,
  isLoading = false,
}: NewContractModalProps) {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
    reset,
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  // Cargar todos los contratos para chequear unicidad
  const { data: allContracts } = useContracts();
  const watchedName = watch('influencer_name') ?? '';

  // Detectar contrato activo existente para el mismo influencer
  const existingActive = allContracts?.data?.items?.find(
    (c) =>
      c.contract_status === 'Activo' &&
      c.influencer_name.toLowerCase() === watchedName.trim().toLowerCase()
  );

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) reset();
    onOpenChange(isOpen);
  };

  const onFormSubmit = async (data: FormData) => {
    await onSubmit({ influencer_name: data.influencer_name.trim(), end_date: data.end_date });
    reset();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Nuevo Contrato</DialogTitle>
          <DialogDescription>
            Registrá un influencer con su fecha de fin. El sistema genera el ID y el patrón de matching automáticamente.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
          {/* Warning unicidad */}
          {existingActive && watchedName.trim().length > 2 && (
            <AlertBanner
              variant="warning"
              message={`Ya existe un contrato activo para este influencer (${existingActive.contract_id}). Verificá antes de continuar.`}
            />
          )}

          {/* Influencer Name */}
          <div className="space-y-2">
            <Label htmlFor="influencer_name">Nombre del Influencer *</Label>
            <Input
              id="influencer_name"
              placeholder="Ej: Farid Dieck"
              {...register('influencer_name')}
            />
            {errors.influencer_name && (
              <p className="text-sm text-red-600">{errors.influencer_name.message}</p>
            )}
          </div>

          {/* End Date */}
          <div className="space-y-2">
            <Label htmlFor="end_date">Fecha de Fin del Contrato *</Label>
            <Input id="end_date" type="date" {...register('end_date')} />
            {errors.end_date && (
              <p className="text-sm text-red-600">{errors.end_date.message}</p>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            El ID del contrato y el patrón de búsqueda de anuncios se generan automáticamente.
          </p>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleClose(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Creando...' : 'Crear Contrato'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
