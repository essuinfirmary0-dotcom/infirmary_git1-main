import React from 'react';
import { useLocation } from 'react-router-dom';
import { motion } from 'motion/react';
import { useApp } from '../context/AppContext';
import { BookingForm } from '../components/BookingForm';

export const ClientBookPage = () => {
  const location = useLocation();
  const { appointments, handleBook, handleReschedule, userProfile, isGuestUser, setStoredAuthUser } = useApp();
  const rescheduleAppointmentId = location.state?.rescheduleAppointmentId;
  const rescheduleAppointment = appointments.find((appointment) => appointment.id === rescheduleAppointmentId) || null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
    >
      <BookingForm
        onBook={handleBook}
        onReschedule={handleReschedule}
        appointments={appointments}
        user={userProfile}
        isGuestUser={isGuestUser}
        onUserUpdated={setStoredAuthUser}
        rescheduleAppointment={rescheduleAppointment}
      />
    </motion.div>
  );
};
