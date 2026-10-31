import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { AppLayout } from '../components/layout/AppLayout';
import { HomePage } from '../pages/HomePage';
import { NotFoundPage } from '../pages/NotFoundPage';

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<AppLayout />}>
        <Route index element={<HomePage />} />
        {/* Sub-routes for Members 1-4 will be mounted here in future feature phases */}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
};
