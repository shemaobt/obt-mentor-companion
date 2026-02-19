import { useQuery } from "@tanstack/react-query";
import type { CompetencyChangeHistory } from "@shared/schema";
import { statusLabels, type CompetencyStatus } from "./types";

interface CompetencyHistoryDisplayProps {
  competencyRecordId: string;
  userId: string;
}

export function CompetencyHistoryDisplay({ competencyRecordId, userId }: CompetencyHistoryDisplayProps) {
  const { data: history = [], isLoading } = useQuery<CompetencyChangeHistory[]>({
    queryKey: ['/api/admin/users', userId, 'competencies', competencyRecordId, 'history'],
    enabled: !!competencyRecordId && !!userId,
  });

  if (isLoading) {
    return (
      <div className="mt-3 text-center py-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="mt-3 text-center py-4">
        <p className="text-sm text-muted-foreground">No change history yet</p>
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-3">
      {history.map((change, index) => (
        <div key={change.id} className="bg-muted/30 rounded-lg p-3" data-testid={`history-item-${index}`}>
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1">
              <p className="text-sm font-medium">
                {statusLabels[change.oldStatus as CompetencyStatus]} → {statusLabels[change.newStatus as CompetencyStatus]}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Changed by {change.changedBy} on {new Date(change.changedAt).toLocaleDateString('en-US', { 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </p>
            </div>
          </div>
          {change.notes && (
            <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">
              {change.notes}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
