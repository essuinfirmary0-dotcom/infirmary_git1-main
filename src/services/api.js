import axios from 'axios';

export const baseURL = import.meta.env.DEV
  ? 'http://localhost:5000'
  : import.meta.env.VITE_BASE_URL;

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

