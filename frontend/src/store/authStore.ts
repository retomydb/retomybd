import { create } from 'zustand';
import { authApi } from '../services/api';

export interface User {
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  display_name?: string;
  avatar_url?: string;
  role: string;
  credits_balance: number;
  is_seller_verified?: boolean;
  is_email_verified?: boolean;
  bio?: string;
  company?: string;
  website?: string;
  location?: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (data: any) => Promise<void>;
  logout: () => void;
  loadUser: () => Promise<void>;
  updateUser: (user: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: (() => {
    try {
      const stored = localStorage.getItem('retomy_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  })(),
  isAuthenticated: !!localStorage.getItem('retomy_access_token'),
  isLoading: false,

  login: async (email: string, password: string) => {
    set({ isLoading: true });
    try {
      const { data } = await authApi.login({ email, password });
      localStorage.setItem('retomy_access_token', data.access_token);
      localStorage.setItem('retomy_refresh_token', data.refresh_token);
      localStorage.setItem('retomy_user', JSON.stringify(data.user));
      set({ user: data.user, isAuthenticated: true, isLoading: false });
    } catch (error: any) {
      set({ isLoading: false });
      throw error;
    }
  },

  signup: async (signupData: any) => {
    set({ isLoading: true });
    try {
      const { data } = await authApi.signup(signupData);
      localStorage.setItem('retomy_access_token', data.access_token);
      localStorage.setItem('retomy_refresh_token', data.refresh_token);
      localStorage.setItem('retomy_user', JSON.stringify(data.user));
      set({ user: data.user, isAuthenticated: true, isLoading: false });
    } catch (error: any) {
      set({ isLoading: false });
      throw error;
    }
  },

  logout: () => {
    localStorage.removeItem('retomy_access_token');
    localStorage.removeItem('retomy_refresh_token');
    localStorage.removeItem('retomy_user');
    set({ user: null, isAuthenticated: false });
  },

  loadUser: async () => {
    const token = localStorage.getItem('retomy_access_token');
    if (!token) {
      set({ user: null, isAuthenticated: false });
      return;
    }
    try {
      const { data } = await authApi.getMe();
      localStorage.setItem('retomy_user', JSON.stringify(data));
      set({ user: data, isAuthenticated: true });
    } catch {
      set({ user: null, isAuthenticated: false });
    }
  },

  updateUser: (updates: Partial<User>) => {
    const current = get().user;
    if (current) {
      const updated = { ...current, ...updates };
      localStorage.setItem('retomy_user', JSON.stringify(updated));
      set({ user: updated });
    }
  },
}));

// Cart store
import { purchasesApi } from '../services/api';

interface CartState {
  items: any[];
  total: number;
  itemCount: number;
  loading: boolean;
  setCart: (items: any[], total: number) => void;
  setLoading: (loading: boolean) => void;
  loadCart: () => Promise<void>;
  removeItem: (datasetId: string) => Promise<void>;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  total: 0,
  itemCount: 0,
  loading: false,
  setCart: (items, total) => set({ items, total, itemCount: items.length }),
  setLoading: (loading) => set({ loading }),
  loadCart: async () => {
    set({ loading: true });
    try {
      const { data } = await purchasesApi.getCart();
      const items = data.items || [];
      const total = items.reduce((sum: number, i: any) => sum + Number(i.Price || 0), 0);
      set({ items, total, itemCount: items.length, loading: false });
    } catch {
      set({ loading: false });
    }
  },
  removeItem: async (datasetId: string) => {
    await purchasesApi.removeFromCart(datasetId);
    await get().loadCart();
  },
}));
