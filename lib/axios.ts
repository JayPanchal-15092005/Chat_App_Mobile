import { auth } from "@/lib/firebase";
import * as Sentry from "@sentry/react-native";
import axios from "axios";
import { useCallback } from "react";

const API_URL = "https://chat-app-backend-zj3i.onrender.com/api";

const api = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
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

// ─────────────────────────────────────────────────────────────────────────────
// useApi — replaces Clerk's getToken() with Firebase getIdToken()
// ─────────────────────────────────────────────────────────────────────────────
export const useApi = () => {
  const apiWithAuth = useCallback(
    async <T>(config: Parameters<typeof api.request>[0]) => {
      // Get Firebase ID token (auto-refreshes when needed)
      const token = await auth().currentUser?.getIdToken();
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
