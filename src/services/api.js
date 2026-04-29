import axios from 'axios';

const RENDER_FALLBACK_URL = 'https://infirmary-git1-main.onrender.com';

const trimTrailingSlash = (value) => String(value || '').trim().replace(/\/+$/, '');

const resolveBaseUrl = () => {
  const configuredUrl = trimTrailingSlash(import.meta.env.VITE_API_URL);
  if (configuredUrl) {
    return configuredUrl;
  }

  if (typeof window !== 'undefined' && window.location.hostname.endsWith('.onrender.com')) {
    return trimTrailingSlash(window.location.origin);
  }

  return RENDER_FALLBACK_URL;
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
