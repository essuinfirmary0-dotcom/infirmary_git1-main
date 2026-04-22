import axios from 'axios';

const RAILWAY_FALLBACK_URL = 'https://discerning-exploration-production-8d2a.up.railway.app';

const trimTrailingSlash = (value) => String(value || '').trim().replace(/\/+$/, '');

const resolveBaseUrl = () => {
  const configuredUrl = trimTrailingSlash(import.meta.env.VITE_API_URL);
  if (configuredUrl) {
    return configuredUrl;
  }

  if (typeof window !== 'undefined' && window.location.hostname.endsWith('.onrender.com')) {
    return trimTrailingSlash(window.location.origin);
  }

  return RAILWAY_FALLBACK_URL;
};

const BASE_URL = resolveBaseUrl();
export const baseURL = BASE_URL;

const api = axios.create({
  baseURL: BASE_URL,
});

export default api;

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
