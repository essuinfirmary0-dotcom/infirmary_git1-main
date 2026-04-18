import React from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ReceiptOverlay } from '../components/KioskCheckIn';

/** Full-screen appointment + queue details after a successful kiosk QR check-in. */
export function KioskAppointmentPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const kioskResult = location.state?.kioskResult;

  if (!kioskResult) {
    return <Navigate to="/kiosk" replace />;
  }

  return (
    <ReceiptOverlay kioskResult={kioskResult} onClose={() => navigate('/kiosk')} />
  );
}
