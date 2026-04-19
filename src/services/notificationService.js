import api from './api';

export const notificationService = {
  getMyNotifications: async () => {
    const { data } = await api.get('/api/notifications');
    return data;
  },

  markAsRead: async (id) => {
    const { data } = await api.patch(`/api/notifications/${id}/read`);
    return data;
  },

  markAllAsRead: async () => {
    const { data } = await api.post('/api/notifications/read-all');
    return data;
  },
};
