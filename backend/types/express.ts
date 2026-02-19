import type { Request, Response, NextFunction } from "express";
import type { User } from "@shared/schema";

export interface SessionRequest extends Request {
  session: Request["session"] & {
    userId?: string;
    regenerate: (callback: (err: Error | null) => void) => void;
    save: (callback: (err: Error | null) => void) => void;
    destroy: (callback: (err: Error | null) => void) => void;
  };
}

export interface AuthenticatedRequest extends SessionRequest {
  userId: string;
  user: User;
}

export type AuthMiddleware = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => Promise<void | Response>;

export type RouteHandler<T = AuthenticatedRequest> = (
  req: T,
  res: Response
) => Promise<void | Response>;

export type SessionCallback = (err: Error | null) => void;
