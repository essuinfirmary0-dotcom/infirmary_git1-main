export const APPOINTMENT_STATUS_DISPLAY_LABELS = {
  Confirmed: 'In Line',
  Cancelled: 'Voided',
};

export function getAppointmentStatusLabel(status, cancellationReason = '') {
  const normalizedStatus = String(status || '').trim();

  if (!normalizedStatus) {
    return '';
  }

  return APPOINTMENT_STATUS_DISPLAY_LABELS[normalizedStatus] || normalizedStatus;
}
