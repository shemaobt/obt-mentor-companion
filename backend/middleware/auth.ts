import type { Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "../types";
import { storage } from "../storage";

function getEffectiveApproval(user: { approvalStatus: string | null; lastLoginAt: Date | null }): string {
  const approvalStatus = user.approvalStatus ?? "approved";
  if (approvalStatus === "pending" && user.lastLoginAt) {
    return "approved";
  }
  return approvalStatus;
}

export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ message: "Authentication required" });
  }

  try {
    const user = await storage.getUserById(req.session.userId);
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    const effectiveApproval = getEffectiveApproval(user);

    if (effectiveApproval === "pending") {
      return res.status(403).json({
        message: "Your account is awaiting admin approval.",
        approvalStatus: "pending",
      });
    }

    if (effectiveApproval === "rejected") {
      return res.status(403).json({
        message: "Your account has been rejected. Please contact support.",
        approvalStatus: "rejected",
      });
    }

    if (effectiveApproval !== "approved") {
      return res.status(403).json({
        message: "Account access denied. Please contact support.",
        approvalStatus: effectiveApproval,
      });
    }

    req.userId = req.session.userId;
    req.user = user;
    return next();
  } catch (error) {
    console.error("Authentication middleware error:", error);
    return res.status(500).json({ message: "Authentication check failed" });
  }
}

export async function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ message: "Authentication required" });
  }

  try {
    const user = await storage.getUserById(req.session.userId);
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    const effectiveApproval = getEffectiveApproval(user);

    if (effectiveApproval === "pending") {
      return res.status(403).json({
        message: "Your account is awaiting admin approval.",
        approvalStatus: "pending",
      });
    }

    if (effectiveApproval === "rejected") {
      return res.status(403).json({
        message: "Your account has been rejected. Please contact support.",
        approvalStatus: "rejected",
      });
    }

    if (effectiveApproval !== "approved") {
      return res.status(403).json({
        message: "Account access denied. Please contact support.",
        approvalStatus: effectiveApproval,
      });
    }

    if (!user.isAdmin) {
      return res.status(403).json({ message: "Admin access required" });
    }

    req.userId = user.id;
    req.user = user;
    return next();
  } catch (error) {
    console.error("Admin authorization error:", error);
    return res.status(500).json({ message: "Authorization check failed" });
  }
}

export async function requireSupervisor(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ message: "Authentication required" });
  }

  try {
    const user = await storage.getUserById(req.session.userId);
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    const effectiveApproval = getEffectiveApproval(user);

    if (effectiveApproval !== "approved") {
      return res.status(403).json({
        message: "Account access denied. Please contact support.",
        approvalStatus: effectiveApproval,
      });
    }

    if (!user.isAdmin && !user.isSupervisor) {
      return res.status(403).json({ message: "Supervisor access required" });
    }

    req.userId = user.id;
    req.user = user;
    return next();
  } catch (error) {
    console.error("Supervisor authorization error:", error);
    return res.status(500).json({ message: "Authorization check failed" });
  }
}

export function requireCSRFHeader(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const customHeader = req.get("X-Requested-With");
  if (customHeader !== "XMLHttpRequest") {
    return res.status(403).json({ message: "Missing required security header" });
  }
  return next();
}

