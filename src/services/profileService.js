import { api } from './api';

export const profileService = {
  getMe: async () => {
    const { data } = await api.get('/api/auth/me');
    return data;
  },
  updateProfile: async (payload) => {
    const { data } = await api.patch('/api/auth/profile', payload);
    return data;
  },
  updatePassword: async (payload) => {
    const { data } = await api.patch('/api/auth/password', payload);
    return data;
  },
};
