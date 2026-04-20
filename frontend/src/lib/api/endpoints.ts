// API Endpoints - Re-export all API functions from client
// Provides a cleaner import API for consumers

export {
  apiClient,
  // Contract endpoints
  createContract,
  getContracts,
  extendContract,
  finalizeContract,
  // Ad endpoints
  getAdsByContract,
  pauseAd,
  getOperationStatus,
  // Operations endpoints
  runNow,
  getOperationsHistory,
  getAlertsHistory,
  // Dashboard
  getRiskQueue,
  // Search
  searchContracts,
} from './client';
