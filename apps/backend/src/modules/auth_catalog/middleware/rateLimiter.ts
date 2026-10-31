import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // Limit each IP to 30 requests per windowMs on auth endpoints
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests from this IP. Please try again after 15 minutes.',
        timestamp: new Date().toISOString(),
        path: req.originalUrl,
      },
    });
  },
  skip: () => process.env.NODE_ENV === 'test', // Skip rate limiting during test executions
});
