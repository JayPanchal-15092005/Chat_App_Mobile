import { useAuthStore } from "@/hooks/useAuthStore";
import * as Sentry from "@sentry/react-native";
import axios from "axios";
import { useCallback } from "react";

// Use env var if set, fallback to hardcoded URL
// Strip surrounding quotes that some .env parsers leave in the value
const API_BASE = (
  process.env.EXPO_PUBLIC_API_URL ?? "https://chat-app-backend-zj3i.onrender.com"
).replace(/^["']|["']$/g, "");
const API_URL = `${API_BASE}/api`;

export const api = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
  // Render free-tier can take up to 60 s on cold start — don't fail early
  timeout: 60_000,
});

// Response interceptor registered once
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      Sentry.logger.error(
        Sentry.logger
          .fmt`API request failed: ${error.config?.method?.toUpperCase()} ${error.config?.url}`,
        {
          status: error.response.status,
          endpoint: error.config?.url,
          method: error.config?.method,
        },
      );
    } else if (error.request) {
      Sentry.logger.warn("API request failed - no response", {
        endpoint: error.config?.url,
        method: error.config?.method,
      });
    }
    return Promise.reject(error);
  },
);

export const useApi = () => {
  const apiWithAuth = useCallback(
    async <T>(config: Parameters<typeof api.request>[0]) => {
      // Get custom JWT from Zustand store (which gets it from SecureStore)
      const token = useAuthStore.getState().token;
      return api.request<T>({
        ...config,
        headers: {
          ...config.headers,
          ...(token && { Authorization: `Bearer ${token}` }),
        },
      });
    },
    [],
  );

  return { api, apiWithAuth };
};
