import { api } from './api';

export const activityLogService = {
  getLogs: async (params = {}) => {
    const searchParams = new URLSearchParams();
    if (params.actionType) searchParams.set('actionType', params.actionType);
    if (params.scope) searchParams.set('scope', params.scope);
    if (params.fromDate) searchParams.set('fromDate', params.fromDate);
    if (params.toDate) searchParams.set('toDate', params.toDate);
    if (params.limit != null) searchParams.set('limit', params.limit);
    if (params.offset != null) searchParams.set('offset', params.offset);
    const qs = searchParams.toString();
    const { data } = await api.get(`/api/activity-logs${qs ? `?${qs}` : ''}`);
    return data;
  },
};
