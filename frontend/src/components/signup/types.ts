import { UseFormReturn } from "react-hook-form";
import { z } from "zod";

export const signupSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string(),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  region: z.string().optional(),
  mentorSupervisor: z.string().optional(),
  supervisorId: z.string().optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export type SignupFormData = z.infer<typeof signupSchema>;

export interface Supervisor {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  fullName: string;
}

export interface ProfileImageUploadProps {
  profileImagePreview: string | null;
  onImageSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export interface SupervisorSelectProps {
  form: UseFormReturn<SignupFormData>;
  supervisors: Supervisor[];
  loadingSupervisors: boolean;
  open: boolean;
  setOpen: (open: boolean) => void;
}

export interface PasswordFieldsProps {
  form: UseFormReturn<SignupFormData>;
  showPassword: boolean;
  showConfirmPassword: boolean;
  setShowPassword: (show: boolean) => void;
  setShowConfirmPassword: (show: boolean) => void;
}
