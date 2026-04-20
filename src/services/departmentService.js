import api from './api';

export const departmentService = {
  getAcademicDepartments: async () => {
    const { data } = await api.get('/api/departments');
    return Array.isArray(data) ? data : [];
  },
};
