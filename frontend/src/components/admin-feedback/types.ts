import type { Feedback } from "@shared/schema";
import { Circle, Eye, CheckCircle2, AlertCircle, Tag, MessageSquare } from "lucide-react";
import React from "react";

export interface FeedbackCardProps {
  feedback: Feedback;
  isMobile: boolean;
  onUpdateStatus: (id: string, status: string) => void;
  onDelete: (id: string) => void;
}

export interface FeedbackFiltersProps {
  isMobile: boolean;
  statusFilter: string;
  categoryFilter: string;
  onStatusFilterChange: (value: string) => void;
  onCategoryFilterChange: (value: string) => void;
  onClearFilters: () => void;
}

export function getStatusIcon(status: string): React.ReactNode {
  switch (status) {
    case "new":
      return React.createElement(Circle, { className: "h-4 w-4" });
    case "read":
      return React.createElement(Eye, { className: "h-4 w-4" });
    case "resolved":
      return React.createElement(CheckCircle2, { className: "h-4 w-4" });
    default:
      return React.createElement(AlertCircle, { className: "h-4 w-4" });
  }
}

export function getStatusColor(status: string): string {
  switch (status) {
    case "new":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
    case "read":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
    case "resolved":
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
  }
}

export function getCategoryIcon(category: string | null): React.ReactNode {
  switch (category) {
    case "bug":
      return React.createElement(AlertCircle, { className: "h-3 w-3" });
    case "feature":
      return React.createElement(Tag, { className: "h-3 w-3" });
    case "general":
      return React.createElement(MessageSquare, { className: "h-3 w-3" });
    default:
      return React.createElement(MessageSquare, { className: "h-3 w-3" });
  }
}

export function formatTimestamp(timestamp: string | Date | null | undefined): string {
  if (!timestamp) return "Unknown";
  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  return date.toLocaleString();
}
