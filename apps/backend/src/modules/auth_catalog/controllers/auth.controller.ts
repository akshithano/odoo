import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '@odoo/shared';
import { authService } from '../services/auth.service.js';
import { registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema } from '../validations/auth.validation.js';
import { userService } from '../services/user.service.js';
import { UnauthorizedError } from '../../../core/errors/appError.js';

export class AuthController {
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = registerSchema.parse(req.body);
      const result = await authService.registerCustomer(parsed);
      const response: ApiResponse<typeof result> = {
        success: true,
        message: 'Customer registered successfully',
        data: result,
      };
      res.status(201).json(response);
    } catch (err) {
      next(err);
    }
  }

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = loginSchema.parse(req.body);
      const result = await authService.login(parsed);
      const response: ApiResponse<typeof result> = {
        success: true,
        message: 'Login successful',
        data: result,
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  }

  async logout(req: Request, res: Response, next: NextFunction) {
    try {
      // For stateless JWT, client deletes token; server sends confirmation
      const response: ApiResponse<{ message: string }> = {
        success: true,
        message: 'Logout successful',
        data: { message: 'Token cleared on client' },
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  }

  async forgotPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = forgotPasswordSchema.parse(req.body);
      const result = await authService.forgotPassword(parsed.email);
      const response: ApiResponse<typeof result> = {
        success: true,
        data: result,
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  }

  async resetPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = resetPasswordSchema.parse(req.body);
      const result = await authService.resetPassword(parsed);
      const response: ApiResponse<typeof result> = {
        success: true,
        data: result,
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  }

  async getCurrentUser(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required');
      }
      const user = await userService.getUserById(req.user.id, req.user);
      const response: ApiResponse<typeof user> = {
        success: true,
        data: user,
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  }
}

export const authController = new AuthController();
