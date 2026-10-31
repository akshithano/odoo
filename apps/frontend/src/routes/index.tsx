import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { AppLayout } from '../components/layout/AppLayout';
import { HomePage } from '../pages/HomePage';
import { NotFoundPage } from '../pages/NotFoundPage';

// Member 1 Authentication Pages
import { LoginPage } from '../pages/auth/LoginPage';
import { RegisterPage } from '../pages/auth/RegisterPage';
import { ForgotPasswordPage } from '../pages/auth/ForgotPasswordPage';
import { ResetPasswordPage } from '../pages/auth/ResetPasswordPage';

// Member 1 User Management Pages
import { UsersListPage } from '../pages/users/UsersListPage';
import { UserDetailsPage } from '../pages/users/UserDetailsPage';
import { CreateStaffPage } from '../pages/users/CreateStaffPage';

// Member 1 Product Management Pages
import { ProductListPage } from '../pages/products/ProductListPage';
import { ProductCreatePage } from '../pages/products/ProductCreatePage';
import { ProductEditPage } from '../pages/products/ProductEditPage';
import { ProductDetailsPage } from '../pages/products/ProductDetailsPage';

// Member 1 Plan Management Pages
import { PlanListPage } from '../pages/plans/PlanListPage';
import { PlanCreatePage } from '../pages/plans/PlanCreatePage';
import { PlanEditPage } from '../pages/plans/PlanEditPage';
import { PlanDetailsPage } from '../pages/plans/PlanDetailsPage';

// Route Protection Guards
import { ProtectedRoute } from './ProtectedRoute';
import { RoleRoute } from './RoleRoute';
import { UserRole } from '@odoo/shared';

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<AppLayout />}>
        {/* Core Home */}
        <Route index element={<HomePage />} />

        {/* Authentication */}
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route path="forgot-password" element={<ForgotPasswordPage />} />
        <Route path="reset-password/:token" element={<ResetPasswordPage />} />
        <Route path="reset-password" element={<ResetPasswordPage />} />

        {/* Product Catalog */}
        <Route path="products" element={<ProductListPage />} />
        <Route
          path="products/new"
          element={
            <RoleRoute allowedRoles={[UserRole.ADMIN]}>
              <ProductCreatePage />
            </RoleRoute>
          }
        />
        <Route path="products/:id" element={<ProductDetailsPage />} />
        <Route
          path="products/:id/edit"
          element={
            <RoleRoute allowedRoles={[UserRole.ADMIN]}>
              <ProductEditPage />
            </RoleRoute>
          }
        />

        {/* Subscription Plans */}
        <Route path="plans" element={<PlanListPage />} />
        <Route
          path="plans/new"
          element={
            <RoleRoute allowedRoles={[UserRole.ADMIN]}>
              <PlanCreatePage />
            </RoleRoute>
          }
        />
        <Route path="plans/:id" element={<PlanDetailsPage />} />
        <Route
          path="plans/:id/edit"
          element={
            <RoleRoute allowedRoles={[UserRole.ADMIN]}>
              <PlanEditPage />
            </RoleRoute>
          }
        />

        {/* User Management */}
        <Route
          path="users"
          element={
            <RoleRoute allowedRoles={[UserRole.ADMIN, UserRole.STAFF]}>
              <UsersListPage />
            </RoleRoute>
          }
        />
        <Route
          path="users/staff/create"
          element={
            <RoleRoute allowedRoles={[UserRole.ADMIN]}>
              <CreateStaffPage />
            </RoleRoute>
          }
        />
        <Route
          path="users/:id"
          element={
            <ProtectedRoute>
              <UserDetailsPage />
            </ProtectedRoute>
          }
        />

        {/* 404 Catch-All */}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
};
