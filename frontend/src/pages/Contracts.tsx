// Contracts Page - Contract management screen

import { useEffect, useState } from 'react';
import { Plus, Search, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { DataTable, DataTableColumn } from '@/components/domain/DataTable';
import { StatusBadge } from '@/components/ui/Badge';
import { InlineActionIcon } from '@/components/domain/InlineActionIcon';
import { useContracts, useCreateContract, useExtendContract, useFinalizeContract } from '@/hooks/useContracts';
import { cn } from '@/lib/utils';
import type { Contract, ContractStatus } from '@/types/api';
import { useSearchParams } from 'react-router-dom';

// ============================================
// Components Imports
// ============================================

import NewContractModal from './modals/NewContractModal';
import ExtendContractModal from './modals/ExtendContractModal';
import FinalizeContractModal from './modals/FinalizeContractModal';
import AdsModal from './modals/AdsModal';

// ============================================
// Page Component
// ============================================

export default function ContractsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  // State for filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ContractStatus | ''>('');
  
  // State for pagination
  const [page, setPage] = useState(1);
  const pageSize = 10;
  
  // State for sorting
  const [sortKey, setSortKey] = useState('end_date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  
  // State for modals
  const [isNewContractOpen, setIsNewContractOpen] = useState(false);
  const [isExtendContractOpen, setIsExtendContractOpen] = useState(false);
  const [isFinalizeContractOpen, setIsFinalizeContractOpen] = useState(false);
  const [isAdsModalOpen, setIsAdsModalOpen] = useState(false);
  
  // Selected contract for modals
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  
  // API hooks
  const { data: contractsData, isLoading, isFetching, refetch } = useContracts({
    page,
    page_size: pageSize,
    status: statusFilter || undefined,
    influencer_name: searchQuery || undefined,
  });

  // Mutation hooks
  const createContract = useCreateContract();
  const extendContract = useExtendContract();
  const finalizeContract = useFinalizeContract();

  // ============================================
  // Data transformation
  // ============================================

  const contracts = contractsData?.data?.items || [];
  const total = contractsData?.data?.total || 0;

  useEffect(() => {
    const contractId = String(searchParams.get('contract') ?? '').trim();
    const action = String(searchParams.get('action') ?? '').trim().toLowerCase();
    if (!contractId || !action || contracts.length === 0) return;

    const contract = contracts.find((c) => c.contract_id === contractId);
    if (!contract) return;

    setSelectedContract(contract);

    if (action === 'extend' && contract.contract_status !== 'Finalizado') {
      setIsExtendContractOpen(true);
    } else if (action === 'finalize' && contract.contract_status !== 'Finalizado') {
      setIsFinalizeContractOpen(true);
    } else if (action === 'ads') {
      setIsAdsModalOpen(true);
    }

    const next = new URLSearchParams(searchParams);
    next.delete('contract');
    next.delete('action');
    setSearchParams(next, { replace: true });
  }, [contracts, searchParams, setSearchParams]);
  
  // ============================================
  // Table Columns
  // ============================================
  
  const columns: DataTableColumn<Contract>[] = [
    {
      key: 'influencer_name',
      header: 'Influencer',
      sortable: true,
    },
    {
      key: 'start_date',
      header: 'Fecha Inicio',
      sortable: true,
      className: 'text-muted-foreground',
    },
    {
      key: 'end_date',
      header: 'Fecha Fin',
      sortable: true,
      render: (contract) => {
        const daysLeft = getDaysLeft(contract.end_date);
        let className = '';
        if (daysLeft < 0) className = 'text-red-600 font-medium';
        else if (daysLeft <= 2) className = 'text-yellow-600 font-medium';
        return <span className={className}>{contract.end_date}</span>;
      },
    },
    {
      key: 'contract_status',
      header: 'Estado',
      render: (contract) => {
        const variant = contract.contract_status === 'Activo' ? 'success' : 'neutral';
        return <StatusBadge variant={variant} label={contract.contract_status} />;
      },
    },
    {
      key: 'last_check',
      header: 'Última Verificación',
      className: 'text-muted-foreground',
      render: (contract) => contract.last_check 
        ? formatDateTime(contract.last_check) 
        : '-',
    },
    {
      key: 'actions',
      header: 'Acciones',
      className: 'text-center',
      headerClassName: 'text-center',
      render: (contract) => (
        <div className="flex items-center justify-center gap-2">
          <Button
            onClick={() => {
              setSelectedContract(contract);
              setIsAdsModalOpen(true);
            }}
            size="sm"
          >
            Ver Ads
          </Button>
          <InlineActionIcon
            type="extend"
            label="Extender contrato"
            onClick={() => {
              setSelectedContract(contract);
              setIsExtendContractOpen(true);
            }}
            disabled={contract.contract_status === 'Finalizado'}
          />
          <InlineActionIcon
            type="pause"
            label="Finalizar contrato"
            onClick={() => {
              setSelectedContract(contract);
              setIsFinalizeContractOpen(true);
            }}
            disabled={contract.contract_status === 'Finalizado'}
            variant="destructive"
          />
        </div>
      ),
    },
  ];
  
  // ============================================
  // Handlers
  // ============================================
  
  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };
  
  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };
  
  const handleCreateContract = async (data: { influencer_name: string; end_date: string }) => {
    await createContract.mutateAsync({
      influencer_name: data.influencer_name,
      end_date: data.end_date,
    });
    setIsNewContractOpen(false);
    refetch();
  };
  
  const handleExtendContract = async (newEndDate: string, reason?: string) => {
    if (!selectedContract) return;
    
    await extendContract.mutateAsync({
      contractId: selectedContract.contract_id,
      data: {
        new_end_date: newEndDate,
        reason,
      },
    });
    setIsExtendContractOpen(false);
    refetch();
  };
  
  const handleFinalizeContract = async (reason: string) => {
    if (!selectedContract) return;
    
    await finalizeContract.mutateAsync({
      contractId: selectedContract.contract_id,
      data: {
        reason,
        requested_by: 'ops@adskiller',
      },
    });
    setIsFinalizeContractOpen(false);
    refetch();
  };
  
  // contracts ya viene filtrado por searchQuery desde el hook (filter se aplica antes de paginar)
  const filteredContracts = contracts;
  
  // ============================================
  // Render
  // ============================================
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Influencers</h1>
          <p className="text-muted-foreground">
            Gestiona contratos de influencers y monitorea vencimientos
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={cn("mr-2 h-4 w-4", isFetching && "animate-spin")} />
            {isFetching ? 'Actualizando...' : 'Refrescar'}
          </Button>
          <Button onClick={() => setIsNewContractOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo Influencer
          </Button>
        </div>
      </div>
      
      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex-1 max-w-sm">
          <Input
            placeholder="Buscar por influencer..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
            icon={<Search className="h-4 w-4" />}
          />
        </div>
        
        <select
          className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as ContractStatus | '')}
        >
          <option value="">Todos los estados</option>
          <option value="Activo">Activo</option>
          <option value="Finalizado">Finalizado</option>
        </select>
        
      </div>
      
      {/* Table */}
      <DataTable
        columns={columns}
        data={filteredContracts}
        keyField="contract_id"
        loading={isLoading}
        sortKey={sortKey}
        sortDirection={sortDirection}
        onSort={handleSort}
        page={page}
        pageSize={pageSize}
        total={total}
        onPageChange={handlePageChange}
        emptyMessage="No hay contratos todavía. Crea tu primer contrato."
        onEmptyAction={() => setIsNewContractOpen(true)}
        emptyActionLabel="Crear Contrato"
      />
      
      {/* Modals */}
      <NewContractModal
        open={isNewContractOpen}
        onOpenChange={setIsNewContractOpen}
        onSubmit={handleCreateContract}
        isLoading={createContract.isPending}
      />
      
      {selectedContract && (
        <AdsModal
          contract={selectedContract}
          open={isAdsModalOpen}
          onOpenChange={setIsAdsModalOpen}
        />
      )}

      {selectedContract && (
        <>
          <ExtendContractModal
            open={isExtendContractOpen}
            onOpenChange={setIsExtendContractOpen}
            contract={selectedContract}
            onSubmit={handleExtendContract}
            isLoading={extendContract.isPending}
          />
          
          <FinalizeContractModal
            open={isFinalizeContractOpen}
            onOpenChange={setIsFinalizeContractOpen}
            contract={selectedContract}
            onSubmit={handleFinalizeContract}
            isLoading={finalizeContract.isPending}
          />
        </>
      )}
    </div>
  );
}

// ============================================
// Helper functions
// ============================================

function getDaysLeft(endDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  const diff = end.getTime() - today.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function formatDateTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
