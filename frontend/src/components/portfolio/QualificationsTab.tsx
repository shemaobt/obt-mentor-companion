import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GraduationCap, Plus, Award, Pencil, Trash2 } from "lucide-react";
import { CertificateManager } from "./CertificateManager";
import type { QualificationsTabProps, CourseLevel } from "./types";

export function QualificationsTab({
  loadingQualifications,
  qualifications,
  qualificationDialogOpen,
  setQualificationDialogOpen,
  newQualCourseTitle,
  setNewQualCourseTitle,
  newQualInstitution,
  setNewQualInstitution,
  newQualCompletionDate,
  setNewQualCompletionDate,
  newQualCourseLevel,
  setNewQualCourseLevel,
  newQualDescription,
  setNewQualDescription,
  editingQualification,
  setEditingQualification,
  editQualificationDialogOpen,
  setEditQualificationDialogOpen,
  uploadingCertificateFor,
  createQualificationMutation,
  updateQualificationMutation,
  deleteQualificationMutation,
  uploadCertificateMutation,
  deleteCertificateMutation
}: QualificationsTabProps) {
  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <GraduationCap className="h-5 w-5" />
                <span>Qualifications</span>
              </CardTitle>
              <CardDescription>
                Manage your formal qualifications and certifications
              </CardDescription>
            </div>
            <Dialog open={qualificationDialogOpen} onOpenChange={setQualificationDialogOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-add-qualification">
                  <Plus className="h-4 w-4 mr-2" />
                  Add
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Qualification</DialogTitle>
                  <DialogDescription>
                    Register a new formal qualification or certification
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="qual-course">Course Title</Label>
                    <Input
                      id="qual-course"
                      value={newQualCourseTitle}
                      onChange={(e) => setNewQualCourseTitle(e.target.value)}
                      placeholder="e.g., OBT Certification"
                      data-testid="input-course-title"
                    />
                  </div>
                  <div>
                    <Label htmlFor="qual-institution">Institution</Label>
                    <Input
                      id="qual-institution"
                      value={newQualInstitution}
                      onChange={(e) => setNewQualInstitution(e.target.value)}
                      placeholder="e.g., YWAM"
                      data-testid="input-institution"
                    />
                  </div>
                  <div>
                    <Label htmlFor="qual-completion">Completion Date</Label>
                    <Input
                      id="qual-completion"
                      type="date"
                      value={newQualCompletionDate}
                      onChange={(e) => setNewQualCompletionDate(e.target.value)}
                      data-testid="input-completion-date"
                    />
                  </div>
                  <div>
                    <Label htmlFor="qual-course-level">Course Level *</Label>
                    <Select value={newQualCourseLevel} onValueChange={(value) => setNewQualCourseLevel(value as CourseLevel)}>
                      <SelectTrigger id="qual-course-level" data-testid="select-course-level">
                        <SelectValue placeholder="Select course level" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="introduction">Introduction</SelectItem>
                        <SelectItem value="certificate">Certificate</SelectItem>
                        <SelectItem value="bachelor">Bachelor</SelectItem>
                        <SelectItem value="master">Master</SelectItem>
                        <SelectItem value="doctoral">Doctoral</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="qual-description">Description</Label>
                    <Textarea
                      id="qual-description"
                      value={newQualDescription}
                      onChange={(e) => setNewQualDescription(e.target.value)}
                      placeholder="Brief description of content..."
                      rows={3}
                      data-testid="input-description"
                      required
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    onClick={() => {
                      if (newQualCourseLevel) {
                        createQualificationMutation.mutate({
                          courseTitle: newQualCourseTitle,
                          institution: newQualInstitution,
                          completionDate: newQualCompletionDate,
                          courseLevel: newQualCourseLevel,
                          description: newQualDescription
                        });
                      }
                    }}
                    disabled={!newQualCourseTitle.trim() || !newQualInstitution.trim() || !newQualCompletionDate || !newQualCourseLevel || !newQualDescription.trim() || createQualificationMutation.isPending}
                    data-testid="button-confirm-add-qualification"
                  >
                    {createQualificationMutation.isPending ? "Adding..." : "Add Qualification"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {loadingQualifications ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            </div>
          ) : qualifications.length === 0 ? (
            <div className="text-center py-8">
              <GraduationCap className="h-12 w-12 text-muted-foreground mx-auto mb-2 opacity-50" />
              <p className="text-sm text-muted-foreground">No qualifications yet</p>
              <p className="text-xs text-muted-foreground">Add your first qualification</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {qualifications.map((qualification) => (
                <Card key={qualification.id} data-testid={`card-qualification-${qualification.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <Award className="h-5 w-5 text-primary" />
                          <h3 className="font-medium" data-testid={`text-course-title-${qualification.id}`}>
                            {qualification.courseTitle}
                          </h3>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2" data-testid={`text-institution-${qualification.id}`}>
                          {qualification.institution}
                        </p>
                        <div className="flex items-center space-x-3 text-sm mb-2 flex-wrap">
                          {qualification.courseLevel && (
                            <Badge variant="secondary" data-testid={`badge-course-level-${qualification.id}`}>
                              {qualification.courseLevel.charAt(0).toUpperCase() + qualification.courseLevel.slice(1)}
                            </Badge>
                          )}
                          {qualification.completionDate && (
                            <span className="text-muted-foreground" data-testid={`text-completion-date-${qualification.id}`}>
                              {new Date(qualification.completionDate).toLocaleDateString('en-US')}
                            </span>
                          )}
                        </div>
                        {qualification.description && (
                          <p className="text-sm text-muted-foreground mb-3" data-testid={`text-description-${qualification.id}`}>
                            {qualification.description}
                          </p>
                        )}

                        <CertificateManager
                          qualificationId={qualification.id}
                          uploadCertificateMutation={uploadCertificateMutation}
                          deleteCertificateMutation={deleteCertificateMutation}
                          uploadingCertificateFor={uploadingCertificateFor}
                        />
                      </div>
                      <div className="flex space-x-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditingQualification(qualification);
                            setEditQualificationDialogOpen(true);
                          }}
                          data-testid={`button-edit-qualification-${qualification.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteQualificationMutation.mutate(qualification.id)}
                          className="text-destructive hover:text-destructive"
                          data-testid={`button-delete-qualification-${qualification.id}`}
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

      <Dialog open={editQualificationDialogOpen} onOpenChange={setEditQualificationDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Qualification</DialogTitle>
            <DialogDescription>
              Update the details of this qualification
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-qual-title">Course Title</Label>
              <Input
                id="edit-qual-title"
                value={editingQualification?.courseTitle || ""}
                onChange={(e) => setEditingQualification(editingQualification ? { ...editingQualification, courseTitle: e.target.value } : null)}
                placeholder="e.g., OBT Facilitator Training"
                data-testid="input-edit-course-title"
              />
            </div>
            <div>
              <Label htmlFor="edit-qual-institution">Institution</Label>
              <Input
                id="edit-qual-institution"
                value={editingQualification?.institution || ""}
                onChange={(e) => setEditingQualification(editingQualification ? { ...editingQualification, institution: e.target.value } : null)}
                placeholder="e.g., YWAM"
                data-testid="input-edit-institution"
              />
            </div>
            <div>
              <Label htmlFor="edit-qual-completion">Completion Date</Label>
              <Input
                id="edit-qual-completion"
                type="date"
                value={editingQualification?.completionDate ? new Date(editingQualification.completionDate).toISOString().split('T')[0] : ""}
                onChange={(e) => setEditingQualification(editingQualification ? { ...editingQualification, completionDate: e.target.value } : null)}
                data-testid="input-edit-completion-date"
              />
            </div>
            <div>
              <Label htmlFor="edit-qual-level">Course Level</Label>
              <Select
                value={editingQualification?.courseLevel || ""}
                onValueChange={(value) => setEditingQualification(editingQualification ? { ...editingQualification, courseLevel: value as CourseLevel } : null)}
              >
                <SelectTrigger id="edit-qual-level" data-testid="select-edit-course-level">
                  <SelectValue placeholder="Select course level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="introduction">Introduction</SelectItem>
                  <SelectItem value="certificate">Certificate</SelectItem>
                  <SelectItem value="bachelor">Bachelor</SelectItem>
                  <SelectItem value="master">Master</SelectItem>
                  <SelectItem value="doctoral">Doctoral</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="edit-qual-description">Description</Label>
              <Textarea
                id="edit-qual-description"
                value={editingQualification?.description || ""}
                onChange={(e) => setEditingQualification(editingQualification ? { ...editingQualification, description: e.target.value } : null)}
                placeholder="Brief description..."
                rows={3}
                data-testid="input-edit-description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => {
                if (editingQualification && editingQualification.courseLevel) {
                  updateQualificationMutation.mutate({
                    id: editingQualification.id,
                    courseTitle: editingQualification.courseTitle,
                    institution: editingQualification.institution,
                    completionDate: editingQualification.completionDate || "",
                    courseLevel: editingQualification.courseLevel as CourseLevel,
                    description: editingQualification.description || ""
                  });
                }
              }}
              disabled={!editingQualification?.courseTitle?.trim() || !editingQualification?.institution?.trim() || updateQualificationMutation.isPending}
              data-testid="button-confirm-edit-qualification"
            >
              {updateQualificationMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
