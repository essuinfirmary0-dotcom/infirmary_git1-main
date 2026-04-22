import api from './api';

export const authService = {
  signup: async (payload) => {
    const { data } = await api.post('/api/auth/signup', payload);
    return data;
  },
  login: async (payload) => {
    const { data } = await api.post('/api/auth/login', payload);
    return data;
  },
  createGuestSession: async () => {
    const { data } = await api.post('/api/auth/guest');
    return data;
  },
  forgotPassword: async (email) => {
    const { data } = await api.post('/api/auth/forgot-password', { email });
    return data;
  },
  resetPassword: async (token, newPassword, confirmPassword) => {
    const { data } = await api.post('/api/auth/reset-password', {
      token,
      newPassword,
      confirmPassword,
    });
    return data;
  },
  kioskCheckIn: async (payload) => {
    const { data } = await api.post('/api/kiosk/check-in', payload);
    return data;
  },
  kioskConfirmCheckIn: async (payload) => {
    const { data } = await api.post('/api/kiosk/confirm-check-in', payload);
    return data;
  },
};
