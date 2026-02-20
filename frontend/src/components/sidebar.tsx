import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import ChangePasswordDialog from "./ChangePasswordDialog";
import LogoWithBackground from "./LogoWithBackground";
import { Plus, X } from "lucide-react";
import type { Chat, AssistantId, ChatChain } from "@shared/schema";
import {
  ChatChainsList,
  RecentChatsList,
  UserMenu,
  RenameChatDialog
} from "./sidebar/index";

interface SidebarProps {
  isMobile?: boolean;
  isOpen?: boolean;
  onClose?: () => void;
  selectedAssistant?: AssistantId;
  onAssistantChange?: (assistantId: AssistantId) => void;
}

export default function Sidebar({ 
  isMobile = false, 
  isOpen = true, 
  onClose, 
  selectedAssistant = 'obtMentor',
  onAssistantChange 
}: SidebarProps = {}) {
  const [location, setLocation] = useLocation();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [chainsExpanded, setChainsExpanded] = useState(true);
  const [renamingChatId, setRenamingChatId] = useState<string | null>(null);
  const [newChatTitle, setNewChatTitle] = useState("");
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const userWithRoles = user as any;
  const isAdmin = userWithRoles?.isAdmin === true;
  const isSupervisor = userWithRoles?.isSupervisor === true;
  
  if (import.meta.env.DEV) {
    console.log(`[Sidebar] User: ${userWithRoles?.email}, isAdmin: ${isAdmin}, isSupervisor: ${isSupervisor}, raw user object:`, user);
  }

  const { data: chats = [] } = useQuery<Chat[]>({
    queryKey: ["/api/chats"],
    retry: false,
  });

  const { data: chatChains = [] } = useQuery<ChatChain[]>({
    queryKey: ["/api/chat-chains"],
    retry: false,
  });

  const { data: unreadFeedbackCount = 0 } = useQuery<{ count: number }, Error, number>({
    queryKey: ["/api/admin/feedback/unread-count"],
    enabled: isAdmin,
    retry: false,
    select: (data) => data?.count || 0,
  });

  const { data: pendingUsersCount = 0 } = useQuery<{ count: number }, Error, number>({
    queryKey: ["/api/admin/users/pending-count"],
    enabled: isAdmin,
    retry: false,
    select: (data) => data?.count || 0,
  });

  const { data: supervisorPendingUsersCount = 0 } = useQuery<{ count: number }, Error, number>({
    queryKey: ["/api/supervisor/pending-users/count"],
    enabled: isSupervisor && !isAdmin,
    retry: false,
    select: (data) => data?.count || 0,
  });

  useEffect(() => {
    if (isAdmin && pendingUsersCount > 0) {
      toast({
        title: "Pending User Approvals",
        description: `You have ${pendingUsersCount} user${pendingUsersCount > 1 ? 's' : ''} awaiting approval. Click User Management to review.`,
        variant: "default",
      });
    }
  }, [pendingUsersCount, isAdmin, toast]);

  useEffect(() => {
    if (isSupervisor && !isAdmin && supervisorPendingUsersCount > 0) {
      toast({
        title: "Pending User Approvals",
        description: `You have ${supervisorPendingUsersCount} supervised user${supervisorPendingUsersCount > 1 ? 's' : ''} awaiting approval. Click My Supervised Users to review.`,
        variant: "default",
      });
    }
  }, [supervisorPendingUsersCount, isSupervisor, isAdmin, toast]);

  const createChatMutation = useMutation({
    mutationFn: async (assistantId: AssistantId) => {
      const response = await apiRequest("POST", "/api/chats", {
        title: "New Chat",
        assistantId: assistantId,
      });
      return response.json();
    },
    onSuccess: (newChat) => {
      queryClient.invalidateQueries({ queryKey: ["/api/chats"] });
      setLocation(`/chat/${newChat.id}`);
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to create new chat",
        variant: "destructive",
      });
    },
  });

  const deleteChatMutation = useMutation({
    mutationFn: async (chatId: string) => {
      const response = await apiRequest("DELETE", `/api/chats/${chatId}`);
      return response.json();
    },
    onSuccess: (_, deletedChatId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/chats"] });
      queryClient.removeQueries({ queryKey: ["/api/chats", deletedChatId] });
      queryClient.removeQueries({ queryKey: ["/api/chats", deletedChatId, "messages"] });
      toast({
        title: "Success",
        description: "Chat deleted successfully",
      });
      const currentPath = window.location.pathname;
      if (currentPath === `/chat/${deletedChatId}`) {
        setLocation('/');
      }
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to delete chat",
        variant: "destructive",
      });
    },
  });

  const renameChatMutation = useMutation({
    mutationFn: async ({ chatId, title }: { chatId: string; title: string }) => {
      const response = await apiRequest("PATCH", `/api/chats/${chatId}`, { title });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chats"] });
      toast({
        title: "Success",
        description: "Chat renamed successfully",
      });
      setRenamingChatId(null);
      setNewChatTitle("");
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to rename chat",
        variant: "destructive",
      });
    },
  });

  const createChainMutation = useMutation({
    mutationFn: async (title: string) => {
      const response = await apiRequest("POST", "/api/chat-chains", {
        title,
        summary: null,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chat-chains"] });
      toast({
        title: "Success",
        description: "Chat chain created successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create chat chain",
        variant: "destructive",
      });
    },
  });

  const deleteChainMutation = useMutation({
    mutationFn: async (chainId: string) => {
      const response = await apiRequest("DELETE", `/api/chat-chains/${chainId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chat-chains"] });
      queryClient.invalidateQueries({ queryKey: ["/api/chats"] });
      toast({
        title: "Success",
        description: "Chat chain deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete chat chain",
        variant: "destructive",
      });
    },
  });

  const continueChainMutation = useMutation({
    mutationFn: async (chainId: string) => {
      const chain = chatChains.find(c => c.id === chainId);
      if (chain?.activeChatId) {
        return { chatId: chain.activeChatId };
      } else {
        const response = await apiRequest("POST", "/api/chats", {
          title: "New Chat",
          assistantId: 'obtMentor',
        });
        const newChat = await response.json();
        
        await apiRequest("POST", `/api/chats/${newChat.id}/chain`, {
          chainId,
        });
        
        return { chatId: newChat.id };
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/chats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/chat-chains"] });
      setLocation(`/chat/${data.chatId}`);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to continue chat chain",
        variant: "destructive",
      });
    },
  });

  const handleStartRename = (chatId: string, title: string) => {
    setRenamingChatId(chatId);
    setNewChatTitle(title);
  };

  const handleConfirmRename = () => {
    if (renamingChatId && newChatTitle.trim()) {
      renameChatMutation.mutate({ chatId: renamingChatId, title: newChatTitle.trim() });
    }
  };

  const handleCancelRename = () => {
    setRenamingChatId(null);
    setNewChatTitle("");
  };

  const handleUserMenuClose = () => {
    setUserMenuOpen(false);
  };

  const handleLogout = () => {
    logout();
    setUserMenuOpen(false);
  };

  return (
    <div className={`w-full h-full ${isMobile ? 'max-w-xs phone-xs:max-w-full phone-sm:max-w-sm' : ''} bg-card ${!isMobile ? 'border-r border-border' : ''} flex flex-col overflow-hidden`}>
      <div className={`${isMobile ? 'p-3 phone-xs:p-2 phone-sm:p-3 pt-[max(1rem,env(safe-area-inset-top))]' : 'p-4'} border-b border-border`}>
        <div className="flex items-center justify-center h-10 relative">
          <div className="flex items-center space-x-3 phone-xs:space-x-2 phone-sm:space-x-3">
            <Link href="/" className="flex items-center justify-center flex-shrink-0 hover:opacity-80 transition-opacity cursor-pointer" data-testid="link-app-logo">
              <LogoWithBackground size="sm" />
            </Link>
            <span className={`font-semibold text-foreground ${isMobile ? 'text-sm phone-xs:text-xs phone-sm:text-lg' : 'text-sm md:text-base'}`}>OBT Mentor Companion</span>
          </div>
          {isMobile && onClose && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className={`absolute right-0 ${isMobile ? 'min-h-[44px] min-w-[44px] h-11 w-11 phone-sm:h-12 phone-sm:w-12' : 'h-8 w-8'} p-0 touch-manipulation`}
              data-testid="button-close-sidebar"
              aria-label="Close sidebar"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="p-3 phone-xs:p-2 phone-sm:p-4 md:p-4">
        <Button
          onClick={() => {
            setLocation('/');
            if (onClose) onClose();
          }}
          className={`w-full justify-center space-x-2 ${isMobile ? 'min-h-[44px] h-11 phone-sm:h-12 text-sm phone-sm:text-base touch-manipulation' : 'h-9 md:h-10'}`}
          data-testid="button-new-chat"
        >
          <Plus className="h-4 w-4" />
          <span>New Chat</span>
        </Button>
      </div>

      <ChatChainsList
        chatChains={chatChains}
        chats={chats}
        chainsExpanded={chainsExpanded}
        isMobile={isMobile}
        onToggleExpanded={() => setChainsExpanded(!chainsExpanded)}
        onContinueChain={(chainId) => continueChainMutation.mutate(chainId)}
        onCreateChain={(title) => createChainMutation.mutate(title)}
        onDeleteChain={(chainId) => deleteChainMutation.mutate(chainId)}
        isContinuePending={continueChainMutation.isPending}
        isCreatePending={createChainMutation.isPending}
      />

      <RecentChatsList
        chats={chats}
        isMobile={isMobile}
        onDeleteChat={(chatId) => deleteChatMutation.mutate(chatId)}
        onStartRename={handleStartRename}
      />

      <UserMenu
        userMenuOpen={userMenuOpen}
        onToggle={() => setUserMenuOpen(!userMenuOpen)}
        user={userWithRoles}
        isAdmin={isAdmin}
        isSupervisor={isSupervisor}
        pendingUsersCount={pendingUsersCount}
        supervisorPendingUsersCount={supervisorPendingUsersCount}
        unreadFeedbackCount={unreadFeedbackCount}
        isMobile={isMobile}
        onClose={handleUserMenuClose}
        onLogout={handleLogout}
      />

      <RenameChatDialog
        renamingChatId={renamingChatId}
        newChatTitle={newChatTitle}
        onTitleChange={setNewChatTitle}
        onConfirm={handleConfirmRename}
        onCancel={handleCancelRename}
        isPending={renameChatMutation.isPending}
      />

      <ChangePasswordDialog 
        open={changePasswordOpen} 
        onOpenChange={setChangePasswordOpen}
      />
    </div>
  );
}
