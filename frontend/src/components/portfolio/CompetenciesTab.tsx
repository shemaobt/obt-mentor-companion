import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Target, CheckCircle2, Circle, RefreshCw, Zap, MessageSquare } from "lucide-react";
import {
  CORE_COMPETENCIES,
  getCompetencyName,
  type CompetencyId
} from "@shared/schema";
import {
  type CompetenciesTabProps,
  type CompetencyStatus,
  competencyStatusOptions,
  statusLabels,
  statusColors
} from "./types";

export function CompetenciesTab({
  loadingCompetencies,
  competencies,
  isMobile,
  user,
  editingCompetency,
  setEditingCompetency,
  tempNotes,
  setTempNotes,
  updateCompetencyMutation,
  recalculateCompetenciesMutation,
  analyzeChatHistoryMutation,
  applyPendingEvidenceMutation
}: CompetenciesTabProps) {
  const getCompetencyStatus = (competencyId: CompetencyId): CompetencyStatus => {
    const comp = competencies.find(c => c.competencyId === competencyId);
    return (comp?.status as CompetencyStatus) || 'not_started';
  };

  const getCompetencyNotes = (competencyId: CompetencyId): string => {
    const comp = competencies.find(c => c.competencyId === competencyId);
    return comp?.notes || '';
  };

  const getCompetencyData = (competencyId: CompetencyId) => {
    return competencies.find(c => c.competencyId === competencyId);
  };

  const hasSuggestion = (competencyId: CompetencyId): boolean => {
    const comp = competencies.find(c => c.competencyId === competencyId);
    return !!(comp?.suggestedStatus && comp.suggestedStatus !== comp.status);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center space-x-2">
              <Target className="h-5 w-5" />
              <span>Core Competencies</span>
            </CardTitle>
            <CardDescription>
              Track the development of your OBT facilitation competencies
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => analyzeChatHistoryMutation.mutate()}
              disabled={analyzeChatHistoryMutation.isPending}
              variant="default"
              size={isMobile ? "sm" : "default"}
              data-testid="button-analyze-chat-history"
            >
              <MessageSquare className={`h-4 w-4 ${isMobile ? '' : 'mr-2'} ${analyzeChatHistoryMutation.isPending ? 'animate-spin' : ''}`} />
              {!isMobile && "Analyze Chats"}
            </Button>
            <Button
              onClick={() => applyPendingEvidenceMutation.mutate()}
              disabled={applyPendingEvidenceMutation.isPending}
              variant="secondary"
              size={isMobile ? "sm" : "default"}
              data-testid="button-apply-evidence"
            >
              <Zap className={`h-4 w-4 ${isMobile ? '' : 'mr-2'} ${applyPendingEvidenceMutation.isPending ? 'animate-spin' : ''}`} />
              {!isMobile && "Apply Evidence"}
            </Button>
            <Button
              onClick={() => recalculateCompetenciesMutation.mutate()}
              disabled={recalculateCompetenciesMutation.isPending}
              variant="outline"
              size={isMobile ? "sm" : "default"}
              data-testid="button-recalculate-competencies"
            >
              <RefreshCw className={`h-4 w-4 ${isMobile ? '' : 'mr-2'} ${recalculateCompetenciesMutation.isPending ? 'animate-spin' : ''}`} />
              {!isMobile && "Recalculate"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loadingCompetencies ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          </div>
        ) : (
          <div className="space-y-4">
            {(Object.keys(CORE_COMPETENCIES) as CompetencyId[]).map((competencyId) => {
              const status = getCompetencyStatus(competencyId);
              const notes = getCompetencyNotes(competencyId);
              const isEditing = editingCompetency === competencyId;
              const competencyData = getCompetencyData(competencyId);
              const showSuggestion = hasSuggestion(competencyId);

              return (
                <Card key={competencyId} data-testid={`card-competency-${competencyId}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          {status === 'proficient' || status === 'advanced' ? (
                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                          ) : (
                            <Circle className="h-5 w-5 text-muted-foreground" />
                          )}
                          <h3 className="font-medium" data-testid={`text-competency-name-${competencyId}`}>
                            {getCompetencyName(competencyId)}
                          </h3>
                        </div>
                        <div className="flex items-center space-x-2 flex-wrap">
                          <Select
                            value={status}
                            onValueChange={(value) => updateCompetencyMutation.mutate({
                              competencyId,
                              status: value as CompetencyStatus,
                              notes
                            })}
                          >
                            <SelectTrigger className="w-48" data-testid={`select-status-${competencyId}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {competencyStatusOptions.map(statusOption => (
                                <SelectItem key={statusOption} value={statusOption}>
                                  {statusLabels[statusOption]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Badge className={statusColors[status]}>
                            {statusLabels[status]}
                          </Badge>
                        </div>
                        {showSuggestion && competencyData?.suggestedStatus && (
                          <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-md" data-testid={`suggestion-${competencyId}`}>
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center space-x-2 mb-1">
                                  <Zap className="h-4 w-4 text-blue-600" />
                                  <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                                    System Suggestion
                                  </span>
                                </div>
                                <p className="text-sm text-blue-700 dark:text-blue-300">
                                  Based on your qualifications, we suggest: <strong>{statusLabels[competencyData.suggestedStatus as CompetencyStatus]}</strong>
                                </p>
                              </div>
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => updateCompetencyMutation.mutate({
                                  competencyId,
                                  status: competencyData.suggestedStatus as CompetencyStatus,
                                  notes
                                })}
                                className="ml-2"
                                data-testid={`button-accept-suggestion-${competencyId}`}
                              >
                                Accept
                              </Button>
                            </div>
                          </div>
                        )}
                        {notes && !isEditing && !notes.startsWith('Auto-calculated:') && (
                          <p className="text-sm text-muted-foreground mt-2" data-testid={`text-competency-notes-${competencyId}`}>
                            {notes}
                          </p>
                        )}
                        {isEditing && (
                          <div className="mt-2 space-y-2">
                            <Textarea
                              value={tempNotes}
                              onChange={(e) => setTempNotes(e.target.value)}
                              placeholder="Add notes about your progress..."
                              rows={2}
                            />
                            <div className="flex space-x-2">
                              <Button
                                size="sm"
                                onClick={() => {
                                  updateCompetencyMutation.mutate({
                                    competencyId,
                                    status,
                                    notes: tempNotes
                                  });
                                  setEditingCompetency(null);
                                }}
                              >
                                Save
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setEditingCompetency(null);
                                  setTempNotes("");
                                }}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        )}
                        {!isEditing && user?.isAdmin && (
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => {
                              setTempNotes(notes);
                              setEditingCompetency(competencyId);
                            }}
                            className="mt-2"
                          >
                            {notes ? 'Edit Notes' : 'Add Notes'}
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
