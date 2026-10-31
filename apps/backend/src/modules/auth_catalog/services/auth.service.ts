import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { UserRole } from '@odoo/shared';
import { prisma } from '../../../core/database/prisma.js';
import { env } from '../../../config/env.js';
import { ConflictError, UnauthorizedError, BadRequestError, ForbiddenError } from '../../../core/errors/appError.js';
import { logger } from '../../../core/logging/logger.js';
import { z } from 'zod';
import { registerSchema, loginSchema, resetPasswordSchema } from '../validations/auth.validation.js';

type RegisterInput = z.infer<typeof registerSchema>;
type LoginInput = z.infer<typeof loginSchema>;
type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export class AuthService {
  /**
   * Generates a signed JWT access token (15m validity)
   */
  public generateAccessToken(user: { id: string; email: string; role: string; customerId?: string | null }): string {
    return jwt.sign(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
        customerId: user.customerId || null,
      },
      env.JWT_SECRET,
      { expiresIn: '15m' }
    );
  }

  /**
   * Registers a new customer and creates linked Customer record
   */
  async registerCustomer(input: RegisterInput) {
    const existing = await prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
    });

    if (existing) {
      throw new ConflictError('An account with this email address already exists');
    }

    const passwordHash = await bcrypt.hash(input.password, 12);

    // Transactionally create User and Customer
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: input.email.toLowerCase(),
          passwordHash,
          role: UserRole.CUSTOMER,
          firstName: input.firstName,
          lastName: input.lastName,
          isActive: true,
        },
      });

      const customer = await tx.customer.create({
        data: {
          userId: user.id,
          companyName: input.companyName,
          phone: input.phone,
          billingAddressLine1: input.billingAddress.line1,
          billingCity: input.billingAddress.city,
          billingState: input.billingAddress.state,
          billingPostalCode: input.billingAddress.postalCode,
          billingCountry: input.billingAddress.country,
          defaultCurrency: 'USD',
        },
      });

      return { user, customer };
    });

    const accessToken = this.generateAccessToken({
      id: result.user.id,
      email: result.user.email,
      role: result.user.role,
      customerId: result.customer.id,
    });

    logger.info(`New customer registered successfully [UserID: ${result.user.id}, CustomerID: ${result.customer.id}]`);

    return {
      user: {
        id: result.user.id,
        email: result.user.email,
        role: result.user.role,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
      },
      customer: {
        id: result.customer.id,
        companyName: result.customer.companyName,
        billingCountry: result.customer.billingCountry,
      },
      accessToken,
    };
  }

  /**
   * Authenticates user credentials and returns JWT token
   */
  async login(input: LoginInput) {
    const user = await prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
      include: { customer: true },
    });

    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }

    if (!user.isActive) {
      throw new ForbiddenError('Account is disabled. Please contact system administrator');
    }

    const isMatch = await bcrypt.compare(input.password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const accessToken = this.generateAccessToken({
      id: user.id,
      email: user.email,
      role: user.role,
      customerId: user.customer?.id,
    });

    logger.info(`User logged in [ID: ${user.id}, Role: ${user.role}]`);

    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      customerId: user.customer?.id || null,
      accessToken,
    };
  }

  /**
   * Generates secure expiring password reset token
   */
  async forgotPassword(email: string) {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    // To prevent email enumeration, return success even if user not found
    if (!user) {
      logger.info(`Password reset requested for non-existent email: ${email}`);
      return { message: 'If this email is registered, a password reset link has been dispatched' };
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour validity

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    const resetLink = `${env.FRONTEND_URL}/reset-password/${rawToken}`;
    logger.info(`[Password Reset Dispatch] To: ${user.email} | Link: ${resetLink}`);

    return {
      message: 'If this email is registered, a password reset link has been dispatched',
      // In development mode, expose reset token to make testing and manual verification frictionless
      ...(env.NODE_ENV !== 'production' ? { devResetToken: rawToken, devResetLink: resetLink } : {}),
    };
  }

  /**
   * Resets password using single-use token
   */
  async resetPassword(input: ResetPasswordInput) {
    const tokenHash = crypto.createHash('sha256').update(input.token).digest('hex');

    const resetRecord = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!resetRecord || resetRecord.usedAt !== null) {
      throw new BadRequestError('Invalid or already used password reset token');
    }

    if (resetRecord.expiresAt < new Date()) {
      throw new BadRequestError('Password reset token has expired. Please request a new one');
    }

    const passwordHash = await bcrypt.hash(input.newPassword, 12);

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: resetRecord.userId },
        data: { passwordHash },
      });

      await tx.passwordResetToken.update({
        where: { id: resetRecord.id },
        data: { usedAt: new Date() },
      });
    });

    logger.info(`Password successfully reset for User ID: ${resetRecord.userId}`);
    return { message: 'Password has been successfully updated. You may now log in.' };
  }
}

export const authService = new AuthService();
