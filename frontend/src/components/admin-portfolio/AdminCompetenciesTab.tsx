import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, Circle, Target, Edit, Save, X, Sparkles } from "lucide-react";
import { CORE_COMPETENCIES, getCompetencyName, type CompetencyId, type FacilitatorCompetency } from "@shared/schema";
import { CompetencyHistoryDisplay } from "./CompetencyHistoryDisplay";
import {
  competencyStatusOptions,
  statusLabels,
  type CompetencyStatus,
  getCompetencyStatus,
  getCompetencyNotes,
  getCompetencyData
} from "./types";

interface AdminCompetenciesTabProps {
  competencies: FacilitatorCompetency[];
  isLoading: boolean;
  userId: string;
  editingCompetency: CompetencyId | null;
  tempNotes: string;
  expandedHistory: CompetencyId | null;
  onEditCompetency: (competencyId: CompetencyId, notes: string) => void;
  onSaveNotes: (competencyId: CompetencyId, status: CompetencyStatus, notes: string) => void;
  onCancelEdit: () => void;
  onStatusChange: (competencyId: CompetencyId, newStatus: CompetencyStatus) => void;
  onToggleHistory: (competencyId: CompetencyId) => void;
  setTempNotes: (notes: string) => void;
}

export function AdminCompetenciesTab({
  competencies,
  isLoading,
  userId,
  editingCompetency,
  tempNotes,
  expandedHistory,
  onEditCompetency,
  onSaveNotes,
  onCancelEdit,
  onStatusChange,
  onToggleHistory,
  setTempNotes
}: AdminCompetenciesTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Target className="h-5 w-5" />
          <span>Core Competencies</span>
        </CardTitle>
        <CardDescription>
          OBT facilitation competencies
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          </div>
        ) : (
          <div className="space-y-4">
            {(Object.keys(CORE_COMPETENCIES) as CompetencyId[]).map((competencyId) => {
              const status = getCompetencyStatus(competencies, competencyId);
              const notes = getCompetencyNotes(competencies, competencyId);
              const isEditing = editingCompetency === competencyId;
              const competencyData = getCompetencyData(competencies, competencyId);

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
                            onValueChange={(value) => onStatusChange(competencyId, value as CompetencyStatus)}
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
                        </div>
                        {!isEditing && notes && (
                          <div className="mt-2 flex items-start justify-between">
                            <p className="text-sm text-muted-foreground flex-1">
                              {notes}
                            </p>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => onEditCompetency(competencyId, notes)}
                              data-testid={`button-edit-notes-${competencyId}`}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                        {!isEditing && !notes && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onEditCompetency(competencyId, '')}
                            className="mt-2"
                            data-testid={`button-add-notes-${competencyId}`}
                          >
                            <Edit className="h-3 w-3 mr-1" />
                            Add Notes
                          </Button>
                        )}
                        {isEditing && (
                          <div className="mt-2 space-y-2">
                            <Textarea
                              value={tempNotes}
                              onChange={(e) => setTempNotes(e.target.value)}
                              placeholder="Add notes about this competency..."
                              className="min-h-[80px]"
                              data-testid={`textarea-notes-${competencyId}`}
                            />
                            <div className="flex space-x-2">
                              <Button
                                size="sm"
                                onClick={() => onSaveNotes(competencyId, status, tempNotes)}
                                data-testid={`button-save-notes-${competencyId}`}
                              >
                                <Save className="h-3 w-3 mr-1" />
                                Save
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={onCancelEdit}
                                data-testid={`button-cancel-notes-${competencyId}`}
                              >
                                <X className="h-3 w-3 mr-1" />
                                Cancel
                              </Button>
                            </div>
                          </div>
                        )}
                        
                        {competencyData?.id && (
                          <div className="mt-4 pt-4 border-t">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => onToggleHistory(competencyId)}
                              className="w-full justify-start"
                              data-testid={`button-toggle-history-${competencyId}`}
                            >
                              <Sparkles className="h-4 w-4 mr-2" />
                              {expandedHistory === competencyId ? "Hide History" : "View Change History"}
                            </Button>
                            
                            {expandedHistory === competencyId && (
                              <CompetencyHistoryDisplay
                                competencyRecordId={competencyData.id}
                                userId={userId}
                              />
                            )}
                          </div>
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
