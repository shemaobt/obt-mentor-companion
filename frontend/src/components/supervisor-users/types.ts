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

export interface SupervisedUserCardProps {
  user: UserWithStats;
  isMobile: boolean;
  onApprove: (userId: string) => void;
  onReject: (userId: string) => void;
  isApproving: boolean;
  isRejecting: boolean;
}

export function formatName(user: UserWithStats): string {
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  return name || "No name set";
}
