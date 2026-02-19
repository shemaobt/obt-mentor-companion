import type { ApiKey } from "@shared/schema";

export interface DashboardStats {
  totalMessages?: number;
  totalApiCalls?: number;
  activeApiKeys?: number;
}

export interface ApiKeyWithMask extends ApiKey {
  maskedKey: string;
}

export interface StatsCardsProps {
  stats: DashboardStats | undefined;
  isMobile: boolean;
}

export interface ApiKeysListProps {
  apiKeys: ApiKeyWithMask[];
  isMobile: boolean;
  onCopyKey: (key: string) => void;
  onDeleteKey: (keyId: string) => void;
}

export interface CreateApiKeyDialogProps {
  newKeyName: string;
  setNewKeyName: (name: string) => void;
  onCreateKey: () => void;
  isPending: boolean;
}

export interface NewKeyAlertProps {
  apiKey: string;
  onCopy: () => void;
  onDismiss: () => void;
}
