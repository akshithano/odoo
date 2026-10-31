import bcrypt from 'bcryptjs';
import { UserRole } from '@odoo/shared';
import { prisma } from '../../../core/database/prisma.js';
import { ConflictError, NotFoundError, ForbiddenError, BadRequestError } from '../../../core/errors/appError.js';
import { logger } from '../../../core/logging/logger.js';
import { z } from 'zod';
import { createStaffSchema } from '../validations/user.validation.js';

type CreateStaffInput = z.infer<typeof createStaffSchema>;

export class UserService {
  /**
   * Admin-only creation of Internal Staff user accounts
   */
  async createStaff(input: CreateStaffInput) {
    const existing = await prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
    });

    if (existing) {
      throw new ConflictError('A user with this email address already exists');
    }

    const passwordHash = await bcrypt.hash(input.password, 12);

    const user = await prisma.user.create({
      data: {
        email: input.email.toLowerCase(),
        passwordHash,
        role: UserRole.STAFF,
        firstName: input.firstName,
        lastName: input.lastName,
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        role: true,
        firstName: true,
        lastName: true,
        isActive: true,
        createdAt: true,
      },
    });

    logger.info(`Internal Staff user provisioned [ID: ${user.id}, Email: ${user.email}]`);
    return user;
  }

  /**
   * Lists users with role filtering, search, and pagination
   */
  async listUsers(options: { role?: UserRole; search?: string; page?: number; limit?: number }) {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 20));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (options.role) {
      where.role = options.role;
    }

    if (options.search) {
      where.OR = [
        { email: { contains: options.search, mode: 'insensitive' } },
        { firstName: { contains: options.search, mode: 'insensitive' } },
        { lastName: { contains: options.search, mode: 'insensitive' } },
      ];
    }

    const [users, totalRecords] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          role: true,
          firstName: true,
          lastName: true,
          isActive: true,
          createdAt: true,
          customer: {
            select: {
              id: true,
              companyName: true,
              billingCountry: true,
            },
          },
        },
      }),
      prisma.user.count({ where }),
    ]);

    const totalPages = Math.ceil(totalRecords / limit);

    return {
      users: users.map((u) => ({
        id: u.id,
        email: u.email,
        role: u.role,
        firstName: u.firstName,
        lastName: u.lastName,
        isActive: u.isActive,
        customerId: u.customer?.id || null,
        companyName: u.customer?.companyName || null,
        createdAt: u.createdAt.toISOString(),
      })),
      meta: {
        page,
        limit,
        totalRecords,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  /**
   * Retrieves user details with role-aware data isolation
   */
  async getUserById(targetUserId: string, requestingUser: { id: string; role: UserRole; customerId?: string | null }) {
    // If Customer role, prevent looking at any other user
    if (requestingUser.role === UserRole.CUSTOMER && requestingUser.id !== targetUserId) {
      throw new ForbiddenError("Access denied: You cannot view another user's profile");
    }

    const user = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        email: true,
        role: true,
        firstName: true,
        lastName: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        customer: true,
      },
    });

    if (!user) {
      throw new NotFoundError(`User with ID ${targetUserId} not found`);
    }

    return user;
  }

  /**
   * Activates or deactivates a user account (Admin only)
   */
  async updateUserStatus(targetUserId: string, isActive: boolean, adminUserId: string) {
    if (targetUserId === adminUserId && !isActive) {
      throw new BadRequestError('Administrators cannot deactivate their own account');
    }

    const user = await prisma.user.findUnique({ where: { id: targetUserId } });
    if (!user) {
      throw new NotFoundError(`User with ID ${targetUserId} not found`);
    }

    const updated = await prisma.user.update({
      where: { id: targetUserId },
      data: { isActive },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        updatedAt: true,
      },
    });

    logger.info(`User status updated [ID: ${targetUserId}, Active: ${isActive}] by Admin [${adminUserId}]`);
    return updated;
  }
}

export const userService = new UserService();
