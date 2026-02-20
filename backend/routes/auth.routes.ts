import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { storage } from "../storage";
import { config } from "../config";
import { requireAuth } from "../middleware/auth";
import { authLimiter, passwordChangeLimiter } from "../middleware/rateLimiter";
import type { AuthenticatedRequest } from "../types";
import type { Response } from "express";

const router = Router();

const signupValidationSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(config.auth.minPasswordLength, `Password must be at least ${config.auth.minPasswordLength} characters long`),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  region: z.string().optional(),
  mentorSupervisor: z.string().optional(),
  supervisorId: z.string().uuid().optional(),
});

const loginValidationSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(1, "Password is required"),
});

const changePasswordValidationSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(config.auth.minPasswordLength, `New password must be at least ${config.auth.minPasswordLength} characters long`),
});

function getEffectiveApproval(user: { approvalStatus: string | null; lastLoginAt: Date | null }): string {
  const approvalStatus = user.approvalStatus ?? "approved";
  if (approvalStatus === "pending" && user.lastLoginAt) {
    return "approved";
  }
  return approvalStatus;
}

router.post("/signup", authLimiter, async (req: any, res: Response) => {
  try {
    const userData = signupValidationSchema.parse(req.body);

    const existingUser = await storage.getUserByEmail(userData.email);
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(userData.password, config.auth.saltRounds);

    const { region, mentorSupervisor, supervisorId, ...userDataOnly } = userData;

    const requireApproval = await storage.getSystemSetting("requireApproval");
    const approvalStatus = requireApproval === "true" ? "pending" : "approved";

    const user = await storage.createUser({
      ...userDataOnly,
      password: hashedPassword,
      approvalStatus,
      supervisorId: supervisorId || null,
    });

    try {
      await storage.createFacilitator({
        userId: user.id,
        region: region || null,
        mentorSupervisor: mentorSupervisor || null,
      });
    } catch (facilitatorError) {
      console.error("Failed to create facilitator profile:", facilitatorError);
    }

    if (user.approvalStatus === "pending") {
      return res.json({
        message: "Account created successfully. Awaiting admin approval.",
        approvalStatus: "pending",
      });
    }

    req.session.regenerate((err: any) => {
      if (err) {
        console.error("Session regeneration failed:", err);
        return res.status(500).json({ message: "Failed to create session" });
      }

      req.session.userId = user.id;

      req.session.save((saveErr: any) => {
        if (saveErr) {
          console.error("Session save failed:", saveErr);
          return res.status(500).json({ message: "Failed to save session" });
        }

        res.json({
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          isAdmin: user.isAdmin,
        });
      });
    });
  } catch (error: any) {
    console.error("Signup error:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: "Validation error",
        errors: error.errors,
      });
    }
    if (error.code === "23505" || error.constraint?.includes("email")) {
      return res.status(400).json({ message: "User already exists" });
    }
    res.status(500).json({ message: "Failed to create account" });
  }
});

router.post("/login", authLimiter, async (req: any, res: Response) => {
  try {
    const { email, password } = loginValidationSchema.parse(req.body);

    const user = await storage.getUserByEmail(email);
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const effectiveApproval = getEffectiveApproval(user);

    if (effectiveApproval === "pending") {
      return res.status(403).json({
        message: "Your account is awaiting admin approval. Please wait for approval before logging in.",
        approvalStatus: "pending",
      });
    }

    if (effectiveApproval === "rejected") {
      return res.status(403).json({
        message: "Your account has been rejected. Please contact support for assistance.",
        approvalStatus: "rejected",
      });
    }

    if (effectiveApproval !== "approved") {
      return res.status(403).json({
        message: "Account access denied. Please contact support.",
        approvalStatus: effectiveApproval,
      });
    }

    req.session.regenerate((err: any) => {
      if (err) {
        console.error("Session regeneration failed:", err);
        return res.status(500).json({ message: "Failed to create session" });
      }

      req.session.userId = user.id;

      req.session.save(async (saveErr: any) => {
        if (saveErr) {
          console.error("Session save failed:", saveErr);
          return res.status(500).json({ message: "Failed to save session" });
        }

        try {
          await storage.updateUserLastLogin(user.id);
        } catch (loginTrackErr) {
          console.error("Failed to track login:", loginTrackErr);
        }

        res.json({
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          isAdmin: user.isAdmin,
        });
      });
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Login failed" });
  }
});

router.post("/logout", (req: any, res: Response) => {
  req.session.destroy((err: any) => {
    if (err) {
      return res.status(500).json({ message: "Failed to logout" });
    }
    res.clearCookie(config.session.cookieName);
    res.json({ message: "Logged out successfully" });
  });
});

router.post("/change-password", requireAuth, passwordChangeLimiter, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { currentPassword, newPassword } = changePasswordValidationSchema.parse(req.body);

    const user = await storage.getUserById(req.userId!);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, config.auth.saltRounds);
    await storage.updateUserPassword(user.id, hashedPassword);

    res.json({ message: "Password changed successfully" });
  } catch (error) {
    console.error("Change password error:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: "Validation error",
        errors: error.errors,
      });
    }
    res.status(500).json({ message: "Failed to change password" });
  }
});

router.get("/user", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await storage.getUserById(req.userId!);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const facilitator = await storage.getFacilitatorByUserId(user.id);

    res.json({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      profileImageUrl: user.profileImageUrl,
      isAdmin: user.isAdmin,
      isSupervisor: user.isSupervisor,
      supervisorId: user.supervisorId,
      approvalStatus: user.approvalStatus,
      facilitatorId: facilitator?.id,
    });
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({ message: "Failed to get user" });
  }
});

export default router;

