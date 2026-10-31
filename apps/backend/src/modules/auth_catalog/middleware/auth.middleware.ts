import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UserRole, JwtPayload } from '@odoo/shared';
import { env } from '../../../config/env.js';
import { UnauthorizedError, ForbiddenError } from '../../../core/errors/appError.js';
import { prisma } from '../../../core/database/prisma.js';

// Extend Express Request interface to include authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: UserRole;
        customerId?: string | null;
      };
    }
  }
}

/**
 * Validates JWT access token and attaches user identity to req.user
 */
export const authenticateToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  // Support mock authentication for local development and integration tests if configured
  if (process.env.MOCK_AUTH === 'true') {
    req.user = {
      id: req.headers['x-mock-user-id']?.toString() || 'usr_mock_admin',
      email: 'mock.admin@enterprise.local',
      role: (req.headers['x-mock-role']?.toString() as UserRole) || UserRole.ADMIN,
      customerId: req.headers['x-mock-customer-id']?.toString() || 'cust_mock_01',
    };
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new UnauthorizedError('Authentication token required'));
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;

    // Verify user is still active in database
    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
      select: { id: true, email: true, role: true, isActive: true, customer: { select: { id: true } } },
    });

    if (!user || !user.isActive) {
      return next(new UnauthorizedError('User account is inactive or no longer exists'));
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role as UserRole,
      customerId: user.customer?.id || null,
    };

    next();
  } catch (error) {
    const err = error as Error;
    if (err.name === 'TokenExpiredError') {
      return next(new UnauthorizedError('Authentication token has expired'));
    }
    return next(new UnauthorizedError('Invalid authentication token'));
  }
};

/**
 * RBAC Guard: Authorizes only specific roles
 */
export const requireRole = (allowedRoles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new ForbiddenError(
          `Access forbidden: requires one of [${allowedRoles.join(', ')}], but current role is ${req.user.role}`
        )
      );
    }

    next();
  };
};

/**
 * Customer Isolation Guard: Guarantees that customers can only view/modify their own resources
 */
export const enforceCustomerIsolation = (
  paramKey = 'customerId'
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }

    // Admins and Staff can query any customer
    if (req.user.role === UserRole.ADMIN || req.user.role === UserRole.STAFF) {
      return next();
    }

    // Customer role: check requested customerId vs authenticated customerId
    const requestedCustomerId = req.params[paramKey] || req.query[paramKey] || req.body[paramKey];

    if (requestedCustomerId && requestedCustomerId !== req.user.customerId) {
      return next(new ForbiddenError("Access denied: You cannot access or modify another customer's data"));
    }

    // Automatically inject authenticated customerId if not specified
    if (!requestedCustomerId && req.user.customerId) {
      req.query[paramKey] = req.user.customerId;
    }

    next();
  };
};
