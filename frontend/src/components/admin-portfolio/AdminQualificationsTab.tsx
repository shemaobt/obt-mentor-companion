import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GraduationCap } from "lucide-react";
import type { FacilitatorQualification } from "@shared/schema";

interface AdminQualificationsTabProps {
  qualifications: FacilitatorQualification[];
  isLoading: boolean;
}

export function AdminQualificationsTab({ qualifications, isLoading }: AdminQualificationsTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <GraduationCap className="h-5 w-5" />
          <span>Qualifications</span>
        </CardTitle>
        <CardDescription>
          Completed courses and certifications
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          </div>
        ) : qualifications.length === 0 ? (
          <div className="text-center py-8">
            <GraduationCap className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No qualifications recorded</p>
          </div>
        ) : (
          <div className="space-y-4">
            {qualifications.map((qualification) => (
              <Card key={qualification.id}>
                <CardContent className="p-4">
                  <h3 className="font-medium text-foreground">{qualification.courseTitle}</h3>
                  <p className="text-sm text-muted-foreground">{qualification.institution}</p>
                  <div className="flex items-center space-x-2 mt-2">
                    {qualification.courseLevel && (
                      <Badge variant="secondary">
                        {qualification.courseLevel.charAt(0).toUpperCase() + qualification.courseLevel.slice(1)}
                      </Badge>
                    )}
                    {qualification.completionDate && (
                      <Badge variant="outline">
                        {new Date(qualification.completionDate).toLocaleDateString()}
                      </Badge>
                    )}
                  </div>
                  {qualification.description && (
                    <p className="text-sm text-muted-foreground mt-2">{qualification.description}</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
