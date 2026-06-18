import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';
import { jwtDecode } from 'jwt-decode';

interface User {
  _id: string;
  name: string;
  email: string;
  avatar?: string;
}

interface AuthState {
  token: string | null;
  user: User | null;
  isLoading: boolean;
  setAuth: (token: string, user: User) => Promise<void>;
  clearAuth: () => Promise<void>;
  restoreToken: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  isLoading: true,

  setAuth: async (token, user) => {
    try {
      await SecureStore.setItemAsync('auth_token', token);
      await SecureStore.setItemAsync('user_data', JSON.stringify(user));
      set({ token, user, isLoading: false });
    } catch (e) {
      console.error("Failed to save auth state", e);
    }
  },

  clearAuth: async () => {
    try {
      await SecureStore.deleteItemAsync('auth_token');
      await SecureStore.deleteItemAsync('user_data');
      set({ token: null, user: null, isLoading: false });
    } catch (e) {
      console.error("Failed to clear auth state", e);
    }
  },

  restoreToken: async () => {
    try {
      const token = await SecureStore.getItemAsync('auth_token');
      const userData = await SecureStore.getItemAsync('user_data');
      
      if (token && userData) {
        // Basic check if token is expired (optional but good practice)
        try {
           const decoded = jwtDecode(token);
           if (decoded.exp && decoded.exp * 1000 < Date.now()) {
             // Token expired
             await SecureStore.deleteItemAsync('auth_token');
             await SecureStore.deleteItemAsync('user_data');
             set({ token: null, user: null, isLoading: false });
             return;
           }
        } catch (e) {
           // Invalid token
           set({ token: null, user: null, isLoading: false });
           return;
        }

        set({ token, user: JSON.parse(userData), isLoading: false });
      } else {
        set({ token: null, user: null, isLoading: false });
      }
    } catch (e) {
      console.error("Failed to restore token", e);
      set({ token: null, user: null, isLoading: false });
    }
  },
}));
