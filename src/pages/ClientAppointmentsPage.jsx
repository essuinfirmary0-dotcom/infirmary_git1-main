import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { useApp } from '../context/AppContext';
import { AppointmentList } from '../components/AppointmentList';

export const ClientAppointmentsPage = () => {
  const navigate = useNavigate();
  const { appointments, userProfile } = useApp();

  const handleRescheduleRequest = (appointment) => {
    navigate('/app/book', {
      state: {
        rescheduleAppointmentId: appointment.id,
      },
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="min-w-0"
    >
      <div className="mb-4 sm:mb-8">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-800">My Appointments</h2>
        <p className="text-slate-500 text-sm sm:text-base">Manage your scheduled visits and history.</p>
      </div>
      <AppointmentList
        appointments={appointments}
        isClient={true}
        user={userProfile}
        onReschedule={handleRescheduleRequest}
      />
    </motion.div>
  );
};
