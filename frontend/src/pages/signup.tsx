import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { Link, useLocation } from "wouter";
import { getActiveTheme } from "@/lib/themes";
import {
  signupSchema,
  type SignupFormData,
  type Supervisor,
  ProfileImageUpload,
  SupervisorSelect,
  PasswordFields,
} from "@/components/signup";

function Signup() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [open, setOpen] = useState(false);
  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [profileImagePreview, setProfileImagePreview] = useState<string | null>(null);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { login } = useAuth();

  const activeTheme = getActiveTheme();
  const logoImage = activeTheme.icon || "/logo.png";

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
      supervisorId: undefined,
    },
  });

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setProfileImage(null);
      setProfileImagePreview(null);
      return;
    }

    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Please upload a JPEG, PNG, WEBP, or GIF image",
        variant: "destructive",
      });
      e.target.value = '';
      setProfileImage(null);
      setProfileImagePreview(null);
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please upload an image smaller than 5MB",
        variant: "destructive",
      });
      e.target.value = '';
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
      if (result.approvalStatus === 'pending') {
        toast({
          title: "Account created!",
          description: "Your account has been created and is awaiting admin approval. You'll be able to log in once approved.",
        });
        setLocation("/login?message=pending");
      } else {
        login(result);
        
        if (profileImage) {
          try {
            await uploadProfileImage();
          } catch (error) {
            console.error('Profile image upload failed:', error);
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
        setLocation("/");
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Signup failed",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: SignupFormData) => {
    const { confirmPassword, ...signupData } = data;
    const normalizedData = {
      ...signupData,
      supervisorId: signupData.supervisorId || undefined,
    };
    signupMutation.mutate(normalizedData);
  };

  return (
    <div className="min-h-screen px-4 py-8 flex items-center justify-center bg-background">
      <Card className="w-full max-w-md my-auto">
        <CardHeader className="text-center">
          <div 
            className="mx-auto h-16 w-16 rounded-lg flex items-center justify-center mb-4 overflow-hidden"
            style={{ backgroundColor: `hsl(${activeTheme.brand.hsl})` }}
          >
            <img 
              src={logoImage} 
              alt="Logo" 
              className="h-14 w-14 object-contain brightness-0 invert"
              data-testid="img-signup-logo"
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

              <ProfileImageUpload
                profileImagePreview={profileImagePreview}
                onImageSelect={handleImageSelect}
              />

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
              
              <SupervisorSelect
                form={form}
                supervisors={supervisors}
                loadingSupervisors={loadingSupervisors}
                open={open}
                setOpen={setOpen}
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
              
              <PasswordFields
                form={form}
                showPassword={showPassword}
                showConfirmPassword={showConfirmPassword}
                setShowPassword={setShowPassword}
                setShowConfirmPassword={setShowConfirmPassword}
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
