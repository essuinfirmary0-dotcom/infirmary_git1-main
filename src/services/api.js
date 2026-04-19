import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || 'https://discerning-exploration-production-8d2a.up.railway.app';
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
