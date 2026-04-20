import { create } from 'zustand';

// ============================================
// App Store - Global State
// ============================================

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'operator';
}

export interface AppState {
  // User
  user: User | null;
  setUser: (user: User | null) => void;
  
  // Theme
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  toggleTheme: () => void;
  
  // UI State
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  
  // Search
  globalSearch: string;
  setGlobalSearch: (search: string) => void;
  
  // Loading states
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  // User - default demo user for MVP
  user: {
    id: 'demo-001',
    name: 'Operador Demo',
    email: 'ops@adskiller',
    role: 'operator',
  },
  setUser: (user) => set({ user }),
  
  // Theme - default to light for MVP
  theme: 'light',
  setTheme: (theme) => set({ theme }),
  toggleTheme: () => set((state) => ({ 
    theme: state.theme === 'light' ? 'dark' : 'light' 
  })),
  
  // Sidebar - default open on desktop
  sidebarOpen: true,
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  toggleSidebar: () => set((state) => ({ 
    sidebarOpen: !state.sidebarOpen 
  })),
  
  // Global search
  globalSearch: '',
  setGlobalSearch: (globalSearch) => set({ globalSearch }),
  
  // Loading
  isLoading: false,
  setIsLoading: (isLoading) => set({ isLoading }),
}));