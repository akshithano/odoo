import { Request, Response, NextFunction } from 'express';
import { ApiResponse, UserRole } from '@odoo/shared';
import { userService } from '../services/user.service.js';
import { createStaffSchema, updateUserStatusSchema } from '../validations/user.validation.js';
import { UnauthorizedError } from '../../../core/errors/appError.js';

export class UserController {
  async createStaff(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = createStaffSchema.parse(req.body);
      const staffUser = await userService.createStaff(parsed);
      const response: ApiResponse<typeof staffUser> = {
        success: true,
        message: 'Internal staff account provisioned successfully',
        data: staffUser,
      };
      res.status(201).json(response);
    } catch (err) {
      next(err);
    }
  }

  async listUsers(req: Request, res: Response, next: NextFunction) {
    try {
      const role = req.query.role as UserRole | undefined;
      const search = req.query.search as string | undefined;
      const page = req.query.page ? Number(req.query.page) : undefined;
      const limit = req.query.limit ? Number(req.query.limit) : undefined;

      const result = await userService.listUsers({ role, search, page, limit });
      const response: ApiResponse<typeof result.users> = {
        success: true,
        data: result.users,
        meta: result.meta,
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  }

  async getUserById(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required');
      }
      const user = await userService.getUserById(req.params.id, req.user);
      const response: ApiResponse<typeof user> = {
        success: true,
        data: user,
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  }

  async updateUserStatus(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required');
      }
      const parsed = updateUserStatusSchema.parse(req.body);
      const updated = await userService.updateUserStatus(req.params.id, parsed.isActive, req.user.id);
      const response: ApiResponse<typeof updated> = {
        success: true,
        message: `User account has been ${parsed.isActive ? 'activated' : 'deactivated'}`,
        data: updated,
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  }
}

export const userController = new UserController();
