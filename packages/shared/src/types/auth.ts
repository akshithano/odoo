import { UserRole } from '../enums/roles.js';

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  customerId?: string | null;
  isActive: boolean;
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  customerId?: string | null;
  iat?: number;
  exp?: number;
}
