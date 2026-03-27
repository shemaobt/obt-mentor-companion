import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Link, useLocation } from "wouter";
import { Eye, EyeOff, KeyRound, CheckCircle, XCircle } from "lucide-react";
import { AuthLayout } from "@/components/AuthLayout";

const resetPasswordSchema = z.object({
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type ResetPasswordData = z.infer<typeof resetPasswordSchema>;

export default function ResetPassword() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const token = new URLSearchParams(window.location.search).get('token');

  const form = useForm<ResetPasswordData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const mutation = useMutation({
    mutationFn: async (data: ResetPasswordData) => {
      const response = await apiRequest("POST", "/api/auth/reset-password", { token, password: data.password });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Password reset!", description: "You can now log in with your new password." });
      setTimeout(() => setLocation("/login?message=password-reset"), 1500);
    },
    onError: (error: Error) => {
      toast({ title: "Reset failed", description: error.message || "Please try again or request a new reset link.", variant: "destructive" });
    },
  });

  if (!token) {
    return (
      <AuthLayout>
        <div className="text-center space-y-4">
          <XCircle className="h-12 w-12 text-destructive mx-auto" />
          <h2 className="text-xl font-bold">Invalid reset link</h2>
          <p className="text-muted-foreground text-sm">This password reset link is invalid or has expired.</p>
          <Link href="/forgot-password"><Button className="w-full h-12 rounded-xl">Request a new reset link</Button></Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="mb-8 lg:mb-10 space-y-3">
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground tracking-tight leading-[0.95]">Set new password</h1>
        <p className="text-base text-muted-foreground leading-relaxed max-w-sm">Enter your new password below</p>
      </div>

      {mutation.isSuccess ? (
        <Alert className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
          <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
          <AlertDescription className="text-green-800 dark:text-green-200">Password reset successfully! Redirecting to login...</AlertDescription>
        </Alert>
      ) : (
        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-5">
            <FormField control={form.control} name="password" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium">New Password</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input type={showPassword ? "text" : "password"} placeholder="Enter new password" className="h-12 rounded-xl text-base pr-12" {...field} />
                    <Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3 hover:bg-transparent" onClick={() => setShowPassword(!showPassword)}>
                      {showPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                    </Button>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="confirmPassword" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium">Confirm Password</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input type={showConfirmPassword ? "text" : "password"} placeholder="Confirm new password" className="h-12 rounded-xl text-base pr-12" {...field} />
                    <Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3 hover:bg-transparent" onClick={() => setShowConfirmPassword(!showConfirmPassword)}>
                      {showConfirmPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                    </Button>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <Button type="submit" className="w-full h-12 rounded-xl text-base font-semibold active:scale-[0.98] transition-all duration-200" disabled={mutation.isPending}>
              {mutation.isPending ? "Resetting..." : (<><KeyRound className="mr-2 h-4 w-4" /> Reset password</>)}
            </Button>
          </form>
        </Form>
      )}
    </AuthLayout>
  );
}
