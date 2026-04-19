import api from './api';

const resolveAttachmentSource = (payload = {}) => {
  const attachmentFiles = Array.isArray(payload.attachmentFiles) ? payload.attachmentFiles : [];
  const requirementFiles = Array.isArray(payload.requirementFiles) ? payload.requirementFiles : [];
  return attachmentFiles.length > 0 ? attachmentFiles : requirementFiles;
};

export const appointmentService = {
  filesToAttachments: async (files = []) => {
    return Promise.all(
      (Array.isArray(files) ? files : []).map(
        (entry) =>
          new Promise((resolve, reject) => {
            const file = entry?.file || entry;
            const label = typeof entry?.label === 'string' ? entry.label.trim() : '';
            const reader = new FileReader();
            reader.onload = () =>
              resolve({
                name: file.name,
                type: file.type || 'application/octet-stream',
                label: label || null,
                dataUrl: typeof reader.result === 'string' ? reader.result : '',
              });
            reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`));
            reader.readAsDataURL(file);
          }),
      ),
    );
  },

  book: async (payload) => {
    const attachments = await appointmentService.filesToAttachments(resolveAttachmentSource(payload));
    const { data } = await api.post('/api/appointments', {
      patientName: payload.patientName,
      service: payload.service,
      subcategory: payload.subcategory,
      purpose: payload.purpose,
      date: payload.date,
      time: payload.time,
      notes: payload.notes || '',
      attachments,
    });
    return data;
  },

  reschedule: async (id, payload) => {
    const attachments = await appointmentService.filesToAttachments(resolveAttachmentSource(payload));
    const { data } = await api.patch(`/api/appointments/${id}/reschedule`, {
      patientName: payload.patientName,
      service: payload.service,
      subcategory: payload.subcategory,
      purpose: payload.purpose,
      date: payload.date,
      time: payload.time,
      notes: payload.notes || '',
      attachments,
    });
    return data;
  },

  getMyAppointments: async () => {
    const { data } = await api.get('/api/appointments');
    return data;
  },

  getAllAppointments: async () => {
    const { data } = await api.get('/api/appointments/all');
    return data;
  },

  updateStatus: async (id, status) => {
    const { data } = await api.patch(`/api/appointments/${id}/status`, { status });
    return data;
  },

  cancel: async (id, reason) => {
    const { data } = await api.post(`/api/appointments/${id}/cancel`, {
      reason: reason || '',
    });
    return data;
  },

  getSlotAvailability: async (date, timeSlot) => {
    const { data } = await api.get('/api/appointments/slots', {
      params: { date, timeSlot },
    });
    return data;
  },

  /** Get all time slots with remaining capacity for a given date (for book appointment schedule). */
  getSlotsForDate: async (date) => {
    const { data } = await api.get('/api/appointments/slots', {
      params: { date },
    });
    return data;
  },

  getAttachments: async (id) => {
    const { data } = await api.get(`/api/appointments/${id}/attachments`);
    return data?.attachments || [];
  },
};
