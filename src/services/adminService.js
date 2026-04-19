import api from './api';

export const adminService = {
  createAdminUser: async (payload) => {
    const { data } = await api.post('/api/admin/users', payload);
    return data;
  },
  listAdminUsers: async () => {
    const { data } = await api.get('/api/admin/users');
    return data;
  },
  updateAdminUser: async (id, payload) => {
    const { data } = await api.patch(`/api/admin/users/${id}`, payload);
    return data;
  },
  updateAdminStatus: async (id, status) => {
    const { data } = await api.patch(`/api/admin/users/${id}/status`, { status });
    return data;
  },
  deleteAdminUser: async (id) => {
    const { data } = await api.delete(`/api/admin/users/${id}`);
    return data;
  },
  listClientUsers: async () => {
    const { data } = await api.get('/api/admin/client-users');
    return data;
  },
  updateClientUserStatus: async (id, status) => {
    const { data } = await api.patch(`/api/admin/client-users/${id}/status`, { status });
    return data;
  },
  deleteClientUser: async (id) => {
    const { data } = await api.delete(`/api/admin/client-users/${id}`);
    return data;
  },
};
