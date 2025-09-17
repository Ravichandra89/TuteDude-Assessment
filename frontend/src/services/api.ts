// src/services/api.ts
import axios from "axios";
import type { AxiosInstance } from "axios";

/**
 * Centeral Axios instance for API calls - More Extensible fetching and reducing boilerplate
 * Add interceptors for auth, error handling, logging, etc.
 * Configure base URL and default headers
 * 
 * Usage:
 * import api from 'path/to/api';
 * api.get('/endpoint').then(response => ...).catch(error => ...);
 */

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string) || "http://localhost:4000/api/v1";

const api: AxiosInstance = axios.create({
  baseURL: API_BASE,
  timeout: 20000,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    // Normalize error
    const error = {
      message: err?.response?.data?.message || err.message || "Unknown error",
      status: err?.response?.status || 500,
      details: err?.response?.data?.details || null,
      original: err,
    };
    return Promise.reject(error);
  }
);

export default api;
