import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Activity, Plus, Calendar, Pencil, Trash2 } from "lucide-react";
import type { ActivitiesTabProps, ActivityType } from "./types";

export function ActivitiesTab({
  loadingActivities,
  activities,
  activityDialogOpen,
  setActivityDialogOpen,
  newActivityLanguage,
  setNewActivityLanguage,
  newActivityChapters,
  setNewActivityChapters,
  newActivityDurationYears,
  setNewActivityDurationYears,
  newActivityDurationMonths,
  setNewActivityDurationMonths,
  newActivityNotes,
  setNewActivityNotes,
  editingActivity,
  setEditingActivity,
  editActivityDialogOpen,
  setEditActivityDialogOpen,
  createActivityMutation,
  updateActivityMutation,
  deleteActivityMutation
}: ActivitiesTabProps) {
  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <Activity className="h-5 w-5" />
                <span>Mentorship Activities</span>
              </CardTitle>
              <CardDescription>
                Track your translation and mentorship activities
              </CardDescription>
            </div>
            <Dialog open={activityDialogOpen} onOpenChange={setActivityDialogOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-add-activity">
                  <Plus className="h-4 w-4 mr-2" />
                  Add
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Register Activity</DialogTitle>
                  <DialogDescription>
                    Log your translation or mentorship activity
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="activity-language">Language Name</Label>
                    <Input
                      id="activity-language"
                      value={newActivityLanguage}
                      onChange={(e) => setNewActivityLanguage(e.target.value)}
                      placeholder="e.g., Karajá, Yanomami"
                      data-testid="input-language-name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="activity-chapters">Number of Chapters</Label>
                    <Input
                      id="activity-chapters"
                      type="number"
                      min="0"
                      value={newActivityChapters}
                      onChange={(e) => setNewActivityChapters(e.target.value)}
                      data-testid="input-chapters-count"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="activity-duration-years">Duration (Years)</Label>
                      <Input
                        id="activity-duration-years"
                        type="number"
                        min="0"
                        value={newActivityDurationYears}
                        onChange={(e) => setNewActivityDurationYears(e.target.value)}
                        data-testid="input-duration-years"
                      />
                    </div>
                    <div>
                      <Label htmlFor="activity-duration-months">Duration (Months)</Label>
                      <Input
                        id="activity-duration-months"
                        type="number"
                        min="0"
                        max="11"
                        value={newActivityDurationMonths}
                        onChange={(e) => setNewActivityDurationMonths(e.target.value)}
                        data-testid="input-duration-months"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="activity-notes">Notes (optional)</Label>
                    <Textarea
                      id="activity-notes"
                      value={newActivityNotes}
                      onChange={(e) => setNewActivityNotes(e.target.value)}
                      placeholder="Additional context about the activity..."
                      rows={4}
                      data-testid="input-activity-notes"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    onClick={() => createActivityMutation.mutate({
                      languageName: newActivityLanguage,
                      chaptersCount: parseInt(newActivityChapters) || 0,
                      durationYears: parseInt(newActivityDurationYears) || 0,
                      durationMonths: parseInt(newActivityDurationMonths) || 0,
                      notes: newActivityNotes || undefined
                    })}
                    disabled={!newActivityLanguage.trim() || createActivityMutation.isPending}
                    data-testid="button-confirm-add-activity"
                  >
                    {createActivityMutation.isPending ? "Registering..." : "Register Activity"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {loadingActivities ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            </div>
          ) : activities.length === 0 ? (
            <div className="text-center py-8">
              <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-2 opacity-50" />
              <p className="text-sm text-muted-foreground">No activities yet</p>
              <p className="text-xs text-muted-foreground">Register your first translation activity</p>
            </div>
          ) : (
            <div className="space-y-4">
              {activities.map((activity) => (
                <Card key={activity.id} data-testid={`card-activity-${activity.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        {(activity.activityType === 'translation' || !activity.activityType) && (
                          <>
                            <div className="flex items-center space-x-2 mb-2">
                              <Calendar className="h-5 w-5 text-primary" />
                              <h3 className="font-medium" data-testid={`text-language-name-${activity.id}`}>
                                {activity.title || activity.languageName || 'Bible Translation Work'}
                              </h3>
                            </div>
                            <div className="flex items-center space-x-3 text-sm mb-2">
                              {activity.languageName && !activity.title && (
                                <Badge variant="outline">{activity.languageName}</Badge>
                              )}
                              {activity.chaptersCount && (
                                <Badge>{activity.chaptersCount} chapter(s)</Badge>
                              )}
                              {activity.activityDate && (
                                <span className="text-muted-foreground" data-testid={`text-activity-date-${activity.id}`}>
                                  {new Date(activity.activityDate).toLocaleDateString('en-US')}
                                </span>
                              )}
                            </div>
                            {(activity.notes || activity.description) && (
                              <p className="text-sm text-muted-foreground whitespace-pre-wrap" data-testid={`text-activity-notes-${activity.id}`}>
                                {activity.notes || activity.description}
                              </p>
                            )}
                          </>
                        )}

                        {activity.activityType && activity.activityType !== 'translation' && (
                          <>
                            <div className="flex items-center space-x-2 mb-2">
                              <Calendar className="h-5 w-5 text-primary" />
                              <h3 className="font-medium" data-testid={`text-activity-title-${activity.id}`}>
                                {activity.title || 'Professional Experience'}
                              </h3>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-sm mb-2">
                              <Badge variant="outline">
                                {activity.activityType === 'facilitation' ? 'Facilitation' :
                                  activity.activityType === 'teaching' ? 'Teaching' :
                                    activity.activityType === 'indigenous_work' ? 'Work with People Groups' :
                                      activity.activityType === 'school_work' ? 'School Work' :
                                        'General Experience'}
                              </Badge>
                              {activity.organization && (
                                <span className="text-muted-foreground" data-testid={`text-organization-${activity.id}`}>
                                  {activity.organization}
                                </span>
                              )}
                              {activity.yearsOfExperience && (
                                <span className="text-muted-foreground">
                                  {activity.yearsOfExperience} {activity.yearsOfExperience === 1 ? 'year' : 'years'}
                                </span>
                              )}
                              {activity.activityDate && (
                                <span className="text-muted-foreground" data-testid={`text-activity-date-${activity.id}`}>
                                  {new Date(activity.activityDate).toLocaleDateString('en-US')}
                                </span>
                              )}
                            </div>
                            {activity.description && (
                              <p className="text-sm text-muted-foreground whitespace-pre-wrap" data-testid={`text-activity-description-${activity.id}`}>
                                {activity.description}
                              </p>
                            )}
                          </>
                        )}
                      </div>
                      <div className="flex space-x-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditingActivity(activity);
                            setEditActivityDialogOpen(true);
                          }}
                          data-testid={`button-edit-activity-${activity.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteActivityMutation.mutate(activity.id)}
                          className="text-destructive hover:text-destructive"
                          data-testid={`button-delete-activity-${activity.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={editActivityDialogOpen} onOpenChange={setEditActivityDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Activity</DialogTitle>
            <DialogDescription>
              Update the details of this activity
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-activity-type">Activity Type</Label>
              <Select
                value={editingActivity?.activityType || 'translation'}
                onValueChange={(value) => setEditingActivity(editingActivity ? { ...editingActivity, activityType: value as ActivityType } : null)}
              >
                <SelectTrigger id="edit-activity-type" data-testid="select-edit-activity-type">
                  <SelectValue placeholder="Select activity type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="translation">Translation</SelectItem>
                  <SelectItem value="facilitation">Facilitation</SelectItem>
                  <SelectItem value="teaching">Teaching</SelectItem>
                  <SelectItem value="indigenous_work">Work with People Groups</SelectItem>
                  <SelectItem value="school_work">School Work</SelectItem>
                  <SelectItem value="general_experience">General Experience</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(editingActivity?.activityType === 'translation' || !editingActivity?.activityType) && (
              <>
                <div>
                  <Label htmlFor="edit-activity-language">Language Name</Label>
                  <Input
                    id="edit-activity-language"
                    value={editingActivity?.languageName || ""}
                    onChange={(e) => setEditingActivity(editingActivity ? { ...editingActivity, languageName: e.target.value } : null)}
                    placeholder="e.g., Portuguese, Spanish"
                    data-testid="input-edit-language"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-activity-chapters">Chapters Translated</Label>
                  <Input
                    id="edit-activity-chapters"
                    type="number"
                    min="0"
                    value={editingActivity?.chaptersCount || 0}
                    onChange={(e) => setEditingActivity(editingActivity ? { ...editingActivity, chaptersCount: parseInt(e.target.value) || 0 } : null)}
                    data-testid="input-edit-chapters"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="edit-duration-years">Duration (Years)</Label>
                    <Input
                      id="edit-duration-years"
                      type="number"
                      min="0"
                      value={editingActivity?.durationYears || 0}
                      onChange={(e) => setEditingActivity(editingActivity ? { ...editingActivity, durationYears: parseInt(e.target.value) || 0 } : null)}
                      data-testid="input-edit-duration-years"
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-duration-months">Duration (Months)</Label>
                    <Input
                      id="edit-duration-months"
                      type="number"
                      min="0"
                      max="11"
                      value={editingActivity?.durationMonths || 0}
                      onChange={(e) => setEditingActivity(editingActivity ? { ...editingActivity, durationMonths: parseInt(e.target.value) || 0 } : null)}
                      data-testid="input-edit-duration-months"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="edit-activity-notes">Notes</Label>
                  <Textarea
                    id="edit-activity-notes"
                    value={editingActivity?.notes || ""}
                    onChange={(e) => setEditingActivity(editingActivity ? { ...editingActivity, notes: e.target.value } : null)}
                    placeholder="Additional context about the activity..."
                    rows={4}
                    data-testid="input-edit-notes"
                  />
                </div>
              </>
            )}

            {editingActivity?.activityType && editingActivity.activityType !== 'translation' && (
              <>
                <div>
                  <Label htmlFor="edit-activity-title">Title</Label>
                  <Input
                    id="edit-activity-title"
                    value={editingActivity?.title || ""}
                    onChange={(e) => setEditingActivity(editingActivity ? { ...editingActivity, title: e.target.value } : null)}
                    placeholder="e.g., Language Consultant, Bible Translator"
                    data-testid="input-edit-title"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-activity-organization">Organization</Label>
                  <Input
                    id="edit-activity-organization"
                    value={editingActivity?.organization || ""}
                    onChange={(e) => setEditingActivity(editingActivity ? { ...editingActivity, organization: e.target.value } : null)}
                    placeholder="e.g., Wycliffe, SIL"
                    data-testid="input-edit-organization"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-activity-years">Years of Experience</Label>
                  <Input
                    id="edit-activity-years"
                    type="number"
                    min="0"
                    value={editingActivity?.yearsOfExperience || 0}
                    onChange={(e) => setEditingActivity(editingActivity ? { ...editingActivity, yearsOfExperience: parseInt(e.target.value) || 0 } : null)}
                    data-testid="input-edit-years-experience"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-activity-description">Description</Label>
                  <Textarea
                    id="edit-activity-description"
                    value={editingActivity?.description || ""}
                    onChange={(e) => setEditingActivity(editingActivity ? { ...editingActivity, description: e.target.value } : null)}
                    placeholder="Describe your role and responsibilities..."
                    rows={4}
                    data-testid="input-edit-description"
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button
              onClick={() => {
                if (editingActivity) {
                  updateActivityMutation.mutate({
                    id: editingActivity.id,
                    activityType: editingActivity.activityType,
                    languageName: editingActivity.languageName || undefined,
                    chaptersCount: editingActivity.chaptersCount || undefined,
                    durationYears: editingActivity.durationYears || undefined,
                    durationMonths: editingActivity.durationMonths || undefined,
                    notes: editingActivity.notes || undefined,
                    title: editingActivity.title || undefined,
                    organization: editingActivity.organization || undefined,
                    yearsOfExperience: editingActivity.yearsOfExperience || undefined,
                    description: editingActivity.description || undefined
                  });
                }
              }}
              disabled={updateActivityMutation.isPending}
              data-testid="button-confirm-edit-activity"
            >
              {updateActivityMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
