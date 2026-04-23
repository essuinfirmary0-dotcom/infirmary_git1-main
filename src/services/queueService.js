import api from './api';

export const queueService = {
  list: async ({ status, date } = {}) => {
    const params = new URLSearchParams();
    if (status && status !== 'All') params.set('status', status);
    if (date) params.set('date', date);
    const query = params.toString();
    const { data } = await api.get(`/api/queues${query ? `?${query}` : ''}`);
    return data;
  },
  updateStatus: async (id, status) => {
    const { data } = await api.patch(`/api/queues/${id}/status`, {
      status,
    });
    return data;
  },
  myToday: async () => {
    const { data } = await api.get('/api/queues/my');
    return data;
  },
};
