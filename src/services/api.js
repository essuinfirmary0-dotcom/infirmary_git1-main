import axios from 'axios';

// Vite exposes env vars prefixed with VITE
export const baseURL =
  import.meta.env.VITE_BASE_URL ||
  (import.meta.env.DEV ? 'http://localhost:5000' : window.location.origin);

export const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

