import React from 'react';
import { KioskCheckIn } from '../components/KioskCheckIn';

/** Full-screen self-service check-in for kiosk hardware (browser kiosk mode → `/kiosk`). */
export function KioskLandingPage() {
  return <KioskCheckIn />;
}
