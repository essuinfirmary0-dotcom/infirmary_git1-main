import { getDay } from 'date-fns';

export const APPOINTMENT_BOOKING_BLOCKED_DAY_MESSAGE = 'Friday, Saturday, and Sunday are unavailable for booking.';

export const isInfirmaryClosedOnDate = (date) => {
  const day = getDay(date);
  return day === 0 || day === 5 || day === 6;
};
