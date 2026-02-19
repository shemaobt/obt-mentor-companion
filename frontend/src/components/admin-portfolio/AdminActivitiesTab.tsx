import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, Calendar } from "lucide-react";
import type { MentorshipActivity } from "@shared/schema";

interface AdminActivitiesTabProps {
  activities: MentorshipActivity[];
  isLoading: boolean;
}

export function AdminActivitiesTab({ activities, isLoading }: AdminActivitiesTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Activity className="h-5 w-5" />
          <span>Activities and Experiences</span>
        </CardTitle>
        <CardDescription>
          Record of translation work and general experiences
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          </div>
        ) : activities.length === 0 ? (
          <div className="text-center py-8">
            <Activity className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No activities recorded</p>
          </div>
        ) : (
          <div className="space-y-4">
            {activities.map((activity) => (
              <Card key={activity.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      {(activity.activityType === 'translation' || !activity.activityType) && (
                        <>
                          <div className="flex items-center space-x-2 mb-2">
                            <Calendar className="h-5 w-5 text-primary" />
                            <h3 className="font-medium text-foreground">{activity.languageName}</h3>
                          </div>
                          <div className="flex items-center space-x-3 text-sm mb-2">
                            <Badge>{activity.chaptersCount} chapter(s)</Badge>
                            {activity.activityDate && (
                              <span className="text-muted-foreground">
                                {new Date(activity.activityDate).toLocaleDateString('en-US')}
                              </span>
                            )}
                          </div>
                          {activity.notes && (
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{activity.notes}</p>
                          )}
                        </>
                      )}

                      {activity.activityType && activity.activityType !== 'translation' && (
                        <>
                          <div className="flex items-center space-x-2 mb-2">
                            <Calendar className="h-5 w-5 text-primary" />
                            <h3 className="font-medium text-foreground">
                              {activity.title || 'Professional Experience'}
                            </h3>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-sm mb-2">
                            <Badge variant="outline">
                              {activity.activityType === 'facilitation' ? 'Facilitation' :
                               activity.activityType === 'teaching' ? 'Teaching' :
                               activity.activityType === 'indigenous_work' ? 'Work with Indigenous Peoples' :
                               activity.activityType === 'school_work' ? 'School Work' :
                               'General Experience'}
                            </Badge>
                            {activity.organization && (
                              <span className="text-muted-foreground">{activity.organization}</span>
                            )}
                            {activity.yearsOfExperience && (
                              <span className="text-muted-foreground">
                                {activity.yearsOfExperience} {activity.yearsOfExperience === 1 ? 'year' : 'years'}
                              </span>
                            )}
                            {activity.activityDate && (
                              <span className="text-muted-foreground">
                                {new Date(activity.activityDate).toLocaleDateString('en-US')}
                              </span>
                            )}
                          </div>
                          {activity.description && (
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{activity.description}</p>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
