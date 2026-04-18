import React from 'react';
import { Outlet } from 'react-router-dom';
import { PublicHeader } from '../components/PublicHeader';

export const PublicLayout = () => {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <PublicHeader />
      <Outlet />
    </div>
  );
};
