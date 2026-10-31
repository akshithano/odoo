import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { ApiErrorResponse } from '@odoo/shared';
import { AppError } from './appError.js';
import { logger } from '../logging/logger.js';
import { env } from '../../config/env.js';

export const errorHandler: ErrorRequestHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): void => {
  const isAppError = err instanceof AppError;
  const statusCode = isAppError ? err.statusCode : 500;
  const code = isAppError ? err.code : 'INTERNAL_SERVER_ERROR';
  const message = isAppError
    ? err.message
    : env.NODE_ENV === 'production'
      ? 'An unexpected error occurred'
      : err.message;
  const details = isAppError ? err.details : undefined;

  // Log 500s or unexpected errors
  if (statusCode >= 500) {
    logger.error(`[Unhandled Error] ${req.method} ${req.originalUrl}: ${err.message}`, {
      stack: err.stack,
      body: req.body,
    });
  } else {
    logger.warn(`[Client Error] ${req.method} ${req.originalUrl} (${statusCode}): ${err.message}`);
  }

  const responsePayload: ApiErrorResponse = {
    success: false,
    error: {
      code,
      message,
      ...(details ? { details } : {}),
      timestamp: new Date().toISOString(),
      path: req.originalUrl,
    },
  };

  res.status(statusCode).json(responsePayload);
};
