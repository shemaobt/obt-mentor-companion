import type { Chat, ChatChain } from "@shared/schema";

export interface SidebarCommonProps {
  isMobile: boolean;
}

export interface ChatChainsListProps extends SidebarCommonProps {
  chatChains: ChatChain[];
  chats: Chat[];
  chainsExpanded: boolean;
  onToggleExpanded: () => void;
  onContinueChain: (chainId: string) => void;
  onCreateChain: (title: string) => void;
  onDeleteChain: (chainId: string) => void;
  isContinuePending: boolean;
  isCreatePending: boolean;
}

export interface RecentChatsListProps extends SidebarCommonProps {
  chats: Chat[];
  onDeleteChat: (chatId: string) => void;
  onStartRename: (chatId: string, title: string) => void;
}

export interface UserMenuProps extends SidebarCommonProps {
  userMenuOpen: boolean;
  onToggle: () => void;
  user: any;
  isAdmin: boolean;
  isSupervisor: boolean;
  pendingUsersCount: number;
  supervisorPendingUsersCount: number;
  unreadFeedbackCount: number;
  onClose: () => void;
  onLogout: () => void;
}

export interface RenameChatDialogProps {
  renamingChatId: string | null;
  newChatTitle: string;
  onTitleChange: (title: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  isPending: boolean;
}

export const formatTimestamp = (timestamp: string | Date | null | undefined): string => {
  if (!timestamp) return "Unknown";
  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  const now = new Date();
  const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
  
  if (diffInHours < 1) return "Just now";
  if (diffInHours < 24) return `${Math.floor(diffInHours)} hours ago`;
  if (diffInHours < 48) return "Yesterday";
  return date.toLocaleDateString();
};
