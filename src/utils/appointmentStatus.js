export const APPOINTMENT_STATUS_DISPLAY_LABELS = {
  Confirmed: 'In Line',
  Cancelled: 'Voided',
};

export function isAbsenceVoidedAppointment(value) {
  const reason = typeof value === 'object'
    ? String(value?.cancellationReason || value?.reason || value?.statusLabel || '')
    : String(value || '');
  const normalizedReason = reason.trim().toLowerCase();

  return normalizedReason.includes('absence')
    || normalizedReason.includes('absent')
    || normalizedReason.includes('did not check in')
    || normalizedReason.includes('missed');
}

export function getAppointmentStatusLabel(status, cancellationReason = '') {
  const normalizedStatus = String(status || '').trim();

  if (!normalizedStatus) {
    return '';
  }

  if (normalizedStatus === 'Cancelled' && isAbsenceVoidedAppointment(cancellationReason)) {
    return 'Voided due to Absence';
  }

  return APPOINTMENT_STATUS_DISPLAY_LABELS[normalizedStatus] || normalizedStatus;
}
