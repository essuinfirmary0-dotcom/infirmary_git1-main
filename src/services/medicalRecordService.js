import api from './api';

export const medicalRecordService = {
  getPatients: async () => {
    const { data } = await api.get('/api/medical-records/patients');
    return data;
  },

  getRecordsByUserId: async (userId) => {
    const { data } = await api.get(`/api/medical-records/${userId}/records`);
    return data;
  },

  /**
   * Create a medical record and optionally upload attachments as JSON data URLs.
   * @param {string} userId
   * @param {{ title: string, notes?: string, attachmentFiles?: File[], imageFiles?: File[], queueId?: string, appointmentId?: string, recordType?: string, purpose?: string, isHardcopyVerified?: boolean, certificateIssued?: boolean }} payload
   */
  createRecord: async (userId, payload) => {
    const {
      title,
      notes,
      attachmentFiles,
      imageFiles,
      queueId,
      appointmentId,
      recordType,
      purpose,
      isHardcopyVerified,
      certificateIssued,
    } = payload || {};
    const files = Array.isArray(attachmentFiles)
      ? attachmentFiles
      : Array.isArray(imageFiles)
        ? imageFiles
        : [];

    const attachments = await Promise.all(
      files.map(
        (file) =>
          new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () =>
              resolve({
                name: file.name,
                type: file.type || 'application/octet-stream',
                dataUrl: typeof reader.result === 'string' ? reader.result : '',
              });
            reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`));
            reader.readAsDataURL(file);
          }),
      ),
    );

    const { data } = await api.post(`/api/medical-records/${userId}/records`, {
      title: title ?? '',
      notes: notes ?? '',
      queueId: queueId ?? '',
      appointmentId: appointmentId ?? '',
      recordType: recordType ?? '',
      purpose: purpose ?? '',
      isHardcopyVerified: Boolean(isHardcopyVerified),
      certificateIssued: Boolean(certificateIssued),
      attachments,
    });
    return data;
  },
};

