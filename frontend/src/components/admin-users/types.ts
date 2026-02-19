export interface UserWithStats {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  isAdmin: boolean;
  isSupervisor?: boolean;
  createdAt: string | Date;
  updatedAt: string | Date;
  lastLoginAt: string | Date | null;
  approvalStatus?: 'pending' | 'approved' | 'rejected' | null;
  approvedAt?: string | Date | null;
  approvedBy?: string | null;
  stats: {
    totalChats: number;
    totalMessages: number;
    totalApiKeys: number;
    totalApiCalls: number;
  };
}

export interface PasswordResetDialogState {
  open: boolean;
  user?: UserWithStats;
  password?: string;
}

export interface ApprovalSetting {
  requireApproval: boolean;
}

export const formatTimestamp = (timestamp: string | Date | null | undefined): string => {
  if (!timestamp) return "Never";
  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  return date.toLocaleString();
};

export const formatName = (user: UserWithStats): string => {
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  return name || "No name set";
};
