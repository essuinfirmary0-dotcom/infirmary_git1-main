import React from 'react';
import { Navigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { useApp } from '../context/AppContext';
import { ProfileView } from '../components/ProfileView';

export const ClientProfilePage = () => {
  const { userProfile, setStoredAuthUser, isGuestUser } = useApp();

  if (isGuestUser) {
    return <Navigate to="/app/book" replace />;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
    >
      <ProfileView user={userProfile} onUserUpdated={setStoredAuthUser} />
    </motion.div>
  );
};
