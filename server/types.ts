import type { Request } from "express";
import type { User } from "@shared/schema";

export interface AuthenticatedRequest extends Request {
  session: Request["session"] & {
    userId?: string;
  };
  userId?: string;
  user?: User;
}

export interface FileRequest extends AuthenticatedRequest {
  file?: Express.Multer.File;
}

