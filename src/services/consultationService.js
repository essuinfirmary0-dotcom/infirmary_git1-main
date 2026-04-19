import api from './api';

export const consultationService = {
  getPatients: async () => {
    const { data } = await api.get('/api/consultations/patients');
    return data;
  },

  getLogsByUserId: async (userId) => {
    const { data } = await api.get(`/api/consultations/${userId}/logs`);
    return data;
  },

  createLog: async (userId, payload) => {
    const { data } = await api.post(`/api/consultations/${userId}/logs`, payload);
    return data;
  },
};

