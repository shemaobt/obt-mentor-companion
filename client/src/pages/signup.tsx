import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { Link, useLocation } from "wouter";
import { Eye, EyeOff, Check, ChevronsUpDown, User, Upload } from "lucide-react";
import { getActiveTheme } from "@/lib/themes";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const signupSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string(),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  region: z.string().optional(),
  mentorSupervisor: z.string().optional(),
  supervisorId: z.string().optional(), // UUID of selected supervisor
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type SignupFormData = z.infer<typeof signupSchema>;

interface Supervisor {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  fullName: string;
}

function Signup() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [open, setOpen] = useState(false);
  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [profileImagePreview, setProfileImagePreview] = useState<string | null>(null);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { login } = useAuth();

  // Get the active theme's logo
  const activeTheme = getActiveTheme();
  const logoImage = activeTheme.icon || "/logo.png";

  // Fetch available supervisors
  const { data: supervisors = [], isLoading: loadingSupervisors } = useQuery<Supervisor[]>({
    queryKey: ['/api/supervisors'],
  });

  const form = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
      firstName: "",
      lastName: "",
      region: "",
      mentorSupervisor: "",
      supervisorId: undefined, // undefined para não enviar no formulário se vazio
    },
  });

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      // Clear state when file input is cleared
      setProfileImage(null);
      setProfileImagePreview(null);
      return;
    }

    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Please upload a JPEG, PNG, WEBP, or GIF image",
        variant: "destructive",
      });
      e.target.value = ''; // Clear the input
      setProfileImage(null);
      setProfileImagePreview(null);
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please upload an image smaller than 5MB",
        variant: "destructive",
      });
      e.target.value = ''; // Clear the input
      setProfileImage(null);
      setProfileImagePreview(null);
      return;
    }

    setProfileImage(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setProfileImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const uploadProfileImage = async () => {
    if (!profileImage) return;

    const formData = new FormData();
    formData.append('image', profileImage);

    const response = await fetch('/api/user/profile-image', {
      method: 'POST',
      body: formData,
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to upload profile image');
    }
  };

  const signupMutation = useMutation({
    mutationFn: async (data: Omit<SignupFormData, 'confirmPassword'>) => {
      const response = await apiRequest("POST", "/api/auth/signup", data);
      return response.json();
    },
    onSuccess: async (result) => {
      // Check if account requires approval
      if (result.approvalStatus === 'pending') {
        toast({
          title: "Account created!",
          description: "Your account has been created and is awaiting admin approval. You'll be able to log in once approved.",
        });
        setLocation("/login?message=pending");
      } else {
        // User was auto-approved and logged in
        login(result);
        
        // Upload profile image if one was selected
        if (profileImage) {
          try {
            await uploadProfileImage();
          } catch (error) {
            console.error('Profile image upload failed:', error);
            // Don't block login if image upload fails
            toast({
              title: "Profile image not saved",
              description: "Your account was created but the profile image failed to upload. You can upload it later in Settings.",
              variant: "default",
            });
          }
        }

        toast({
          title: "Success!",
          description: "Your account has been created successfully.",
        });
        setLocation("/dashboard");
      }
    },
    onError: (error: any) => {
      toast({
        title: "Signup failed",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: SignupFormData) => {
    const { confirmPassword, ...signupData } = data;
    // Remove empty supervisorId to avoid validation errors
    const normalizedData = {
      ...signupData,
      supervisorId: signupData.supervisorId || undefined,
    };
    signupMutation.mutate(normalizedData);
  };

  return (
    <div className="min-h-screen overflow-y-auto px-4 flex items-center justify-center bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div 
            className="mx-auto h-16 w-16 rounded-lg flex items-center justify-center mb-4 overflow-hidden"
            style={{ backgroundColor: `hsl(${activeTheme.brand.hsl})` }}
          >
            <img 
              src={logoImage} 
              alt="Logo" 
              className="h-14 w-14 object-contain"
              data-testid="img-signup-logo"
              style={{ filter: 'brightness(0) invert(1)' }}
            />
          </div>
          <CardTitle className="text-2xl">Create account</CardTitle>
          <CardDescription>
            Sign up to start using OBT Mentor Companion
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="First name"
                          data-testid="input-first-name"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Last name"
                          data-testid="input-last-name"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Profile Image Upload */}
              <div className="flex flex-col items-center space-y-3 py-2">
                <FormLabel>Profile Picture (optional)</FormLabel>
                <div className="relative">
                  <div className="h-24 w-24 rounded-full overflow-hidden bg-muted flex items-center justify-center border-2 border-border">
                    {profileImagePreview ? (
                      <img 
                        src={profileImagePreview} 
                        alt="Profile preview" 
                        className="h-full w-full object-cover"
                        data-testid="img-signup-profile-preview"
                      />
                    ) : (
                      <User className="h-12 w-12 text-muted-foreground" />
                    )}
                  </div>
                </div>
                <div>
                  <input
                    type="file"
                    id="signup-profile-image"
                    accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={handleImageSelect}
                    data-testid="input-signup-profile-image"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => document.getElementById('signup-profile-image')?.click()}
                    data-testid="button-choose-signup-image"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Choose Image
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  Max 5MB (JPEG, PNG, WEBP, or GIF)
                </p>
              </div>

              <FormField
                control={form.control}
                name="region"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Region (optional)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., Northeast Brazil"
                        data-testid="input-region"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="supervisorId"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Supervisor (optional)</FormLabel>
                    <Popover open={open} onOpenChange={setOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={open}
                            className={cn(
                              "w-full justify-between",
                              !field.value && "text-muted-foreground"
                            )}
                            data-testid="button-select-supervisor"
                          >
                            {field.value
                              ? supervisors.find((supervisor) => supervisor.id === field.value)?.fullName
                              : "Select supervisor..."}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
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
                                form.setValue("supervisorId", undefined);
                                setOpen(false);
                              }}
                              data-testid="option-supervisor-none"
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  !field.value ? "opacity-100" : "opacity-0"
                                )}
                              />
                              No supervisor
                            </CommandItem>
                            {supervisors.map((supervisor) => (
                              <CommandItem
                                key={supervisor.id}
                                value={supervisor.fullName}
                                onSelect={() => {
                                  form.setValue("supervisorId", supervisor.id);
                                  setOpen(false);
                                }}
                                data-testid={`option-supervisor-${supervisor.id}`}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    supervisor.id === field.value
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
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="Enter your email"
                        data-testid="input-email"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder="Create a password"
                          data-testid="input-password"
                          {...field}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                          onClick={() => setShowPassword(!showPassword)}
                          data-testid="button-toggle-password"
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showConfirmPassword ? "text" : "password"}
                          placeholder="Confirm your password"
                          data-testid="input-confirm-password"
                          {...field}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          data-testid="button-toggle-confirm-password"
                        >
                          {showConfirmPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full"
                disabled={signupMutation.isPending}
                data-testid="button-signup"
              >
                {signupMutation.isPending ? "Creating account..." : "Create account"}
              </Button>
            </form>
          </Form>

          <div className="mt-6 text-center text-sm">
            <span className="text-muted-foreground">Already have an account? </span>
            <Link href="/login" className="text-primary hover:underline" data-testid="link-login">
              Sign in
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default Signup;