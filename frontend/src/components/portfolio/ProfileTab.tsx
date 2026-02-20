import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { User, Save, Edit, Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProfileTabProps } from "./types";

export function ProfileTab({
  loadingProfile,
  facilitatorProfile,
  isEditingProfile,
  setIsEditingProfile,
  profileRegion,
  setProfileRegion,
  profileSupervisorId,
  setProfileSupervisorId,
  supervisorPopoverOpen,
  setSupervisorPopoverOpen,
  supervisors,
  loadingSupervisors,
  updateProfileMutation
}: ProfileTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <User className="h-5 w-5" />
          <span>Facilitator Profile</span>
        </CardTitle>
        <CardDescription>
          Manage your profile information
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loadingProfile ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <Label htmlFor="profile-region">Region (optional)</Label>
              <div className="flex items-center space-x-2 mt-2">
                <Input
                  id="profile-region"
                  value={profileRegion}
                  onChange={(e) => setProfileRegion(e.target.value)}
                  placeholder="e.g., Northeast Brazil"
                  disabled={!isEditingProfile}
                  data-testid="input-profile-region"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="profile-supervisor">Supervisor (optional)</Label>
              <div className="mt-2">
                <Popover open={supervisorPopoverOpen} onOpenChange={setSupervisorPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={supervisorPopoverOpen}
                      className={cn(
                        "w-full justify-between",
                        !profileSupervisorId && "text-muted-foreground"
                      )}
                      disabled={!isEditingProfile}
                      data-testid="button-select-supervisor"
                    >
                      {profileSupervisorId
                        ? supervisors.find((supervisor) => supervisor.id === profileSupervisorId)?.fullName
                        : "Select supervisor..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0">
                    <Command>
                      <CommandInput placeholder="Search supervisor..." data-testid="input-search-supervisor" />
                      <CommandEmpty>
                        {loadingSupervisors ? "Loading..." : "No supervisor found."}
                      </CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          value="none"
                          onSelect={() => {
                            setProfileSupervisorId(undefined);
                            setSupervisorPopoverOpen(false);
                          }}
                          data-testid="option-supervisor-none"
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              !profileSupervisorId ? "opacity-100" : "opacity-0"
                            )}
                          />
                          No supervisor
                        </CommandItem>
                        {supervisors.map((supervisor) => (
                          <CommandItem
                            key={supervisor.id}
                            value={supervisor.fullName}
                            onSelect={() => {
                              setProfileSupervisorId(supervisor.id);
                              setSupervisorPopoverOpen(false);
                            }}
                            data-testid={`option-supervisor-${supervisor.id}`}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                supervisor.id === profileSupervisorId
                                  ? "opacity-100"
                                  : "opacity-0"
                              )}
                            />
                            {supervisor.fullName}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <div className="flex space-x-2">
              {isEditingProfile ? (
                <>
                  <Button
                    onClick={() => {
                      updateProfileMutation.mutate({
                        region: profileRegion,
                        supervisorId: profileSupervisorId
                      });
                    }}
                    disabled={updateProfileMutation.isPending}
                    data-testid="button-save-profile"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Save
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsEditingProfile(false);
                      if (facilitatorProfile) {
                        setProfileRegion(facilitatorProfile.region || "");
                        setProfileSupervisorId(facilitatorProfile.supervisorId || undefined);
                      }
                    }}
                    disabled={updateProfileMutation.isPending}
                    data-testid="button-cancel-profile"
                  >
                    Cancel
                  </Button>
                </>
              ) : (
                <Button
                  onClick={() => setIsEditingProfile(true)}
                  data-testid="button-edit-profile"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Profile
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
