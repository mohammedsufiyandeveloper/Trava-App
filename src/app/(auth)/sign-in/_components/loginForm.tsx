"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { Loader, Loader2, Github } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useState, useTransition, useEffect } from "react";
import { toast } from "sonner";
import { useTaskCacheStore } from "@/lib/store/task-cache-store";
import { PasswordInput } from "@/components/ui/password-input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { checkUserExistsByPhone } from "@/app/actions/user";
import { Phone, Mail } from "lucide-react";

const GoogleIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

export const LoginForm = () => {
  const router = useRouter();
  const ensureUser = useTaskCacheStore(state => state.ensureUser);
  const searchParams = useSearchParams();

  const [githubPending, startGithubTransition] = useTransition();
  const [googlePending, startGoogleTransition] = useTransition();
  const [emailPending, startEmailTransition] = useTransition();
  const [phonePending, startPhoneTransition] = useTransition();
  // const [firstName, setFirstName] = useState("");
  // const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [phoneOtp, setPhoneOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [activeTab, setActiveTab] = useState("email");

  const workspaceId = searchParams.get("workspaceId");
  const role = searchParams.get("role");
  const inviteEmail = searchParams.get("email");

  useEffect(() => {
    if (inviteEmail) {
      setEmail(inviteEmail);
    }
  }, [inviteEmail]);

  async function signInWithGithub() {
    startGithubTransition(async () => {
      const callbackURL = workspaceId && role
        ? `/api/verify?workspaceId=${workspaceId}&role=${role}`
        : "/w";

      await authClient.signIn.social({
        provider: "github",
        callbackURL,
        fetchOptions: {
          onSuccess: (ctx) => {
            toast.success("Signed in with Github, you will be redirected...");
          },
          onError: (error) => {
            toast.error("Internal server error");
          },
        },
      });
    });
  }

  async function signInWithGoogle() {
    startGoogleTransition(async () => {
      const callbackURL = workspaceId && role
        ? `/api/verify?workspaceId=${workspaceId}&role=${role}`
        : "/w";

      await authClient.signIn.social({
        provider: "google",
        callbackURL,
        fetchOptions: {
          onSuccess: (ctx) => {
            toast.success("Signed in with google, you will be redirected...");
          },
          onError: (error) => {
            toast.error("Internal server error");
          },
        },
      });
    });
  }

  async function signInWithEmail() {
    startEmailTransition(async () => {
      try {
        const callbackURL = workspaceId && role
          ? `/api/verify?workspaceId=${workspaceId}&role=${role}`
          : "/w";

        await authClient.signIn.email({
          email,
          password,
          callbackURL,
          fetchOptions: {
            onSuccess: (ctx) => {
              ensureUser(ctx.data.user.id);
              toast.success("Signed in successfully!");
              window.location.href = callbackURL;
            },
            onError: (ctx) => {
              const isNoPassword = ctx.error.code === "USER_HAS_NO_PASSWORD" || 
                                 ctx.error.message.toLowerCase().includes("password") && 
                                 (ctx.error.message.toLowerCase().includes("not set") || ctx.error.message.toLowerCase().includes("no"));

              if (isNoPassword) {
                toast.error("No password found for this account. Please create a password to login with email.", {
                  duration: 5000,
                });
                // Redirect to forgot password to trigger the reset flow
                setTimeout(() => {
                  router.push(`/forgot-password?email=${encodeURIComponent(email)}`);
                }, 2000);
              } else {
                toast.error(ctx.error.message || "Failed to sign in");
              }
            },
          },
        });
      } catch (error) {
        toast.error("An error occurred during sign in");
        console.error(error);
      }
    });
  }

  async function sendPhoneOtp() {
    if (!phoneNumber) {
      toast.error("Please enter a phone number");
      return;
    }

    startPhoneTransition(async () => {
      try {
        // Check if user exists before sending OTP
        const { exists } = await checkUserExistsByPhone(phoneNumber);
        if (!exists) {
          toast.error("This phone number is not registered. Please contact your administrator.", {
            duration: 5000,
          });
          return;
        }

        await authClient.phoneNumber.sendOtp({
          phoneNumber,
          fetchOptions: {
            onSuccess: () => {
              setOtpSent(true);
              toast.success("OTP sent to your phone!");
            },
            onError: (ctx: any) => {
              toast.error(ctx.error.message || "Failed to send OTP");
            },
          },
        });
      } catch (error) {
        toast.error("An error occurred while sending OTP");
        console.error(error);
      }
    });
  }

  async function signInWithPhone() {
    if (!phoneOtp || phoneOtp.length !== 6) {
      toast.error("Please enter a valid 6-digit OTP");
      return;
    }

    startPhoneTransition(async () => {
      try {
        const callbackURL = workspaceId && role
          ? `/api/verify?workspaceId=${workspaceId}&role=${role}`
          : "/w";

        await authClient.phoneNumber.verify({
          phoneNumber,
          code: phoneOtp,
          fetchOptions: {
            onSuccess: (ctx) => {
              ensureUser(ctx.data.user.id);
              toast.success("Signed in successfully!");
              window.location.href = callbackURL;
            },
            onError: (ctx) => {
              toast.error(ctx.error.message || "Failed to sign in");
            },
          },
        });
      } catch (error) {
        toast.error("An error occurred during sign in");
        console.error(error);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">
          {workspaceId ? "Join Workspace" : "Welcome back!"}
        </CardTitle>
        <CardDescription>
          {workspaceId
            ? "Sign in to join the workspace"
            : "Login with your Github, Google or email account"}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="email">
              <Mail className="size-3.5 mr-2" />
              Email
            </TabsTrigger>
            <TabsTrigger value="phone">
              <Phone className="size-3.5 mr-2" />
              Phone
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="email" className="space-y-4">
            <div className="grid gap-3">
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                />
              </div>

              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <a
                    href="/forgot-password"
                    className="text-xs text-muted-foreground hover:text-primary underline-offset-4 hover:underline"
                  >
                    Forgot password?
                  </a>
                </div>
                <PasswordInput
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>

              <Button
                onClick={signInWithEmail}
                disabled={emailPending || !email || !password}
                className="w-full"
              >
                {emailPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <span>Sign In</span>
                )}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="phone" className="space-y-4">
            {!otpSent ? (
               <div className="grid gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="+1234567890"
                    required
                  />
                  <p className="text-[10px] text-muted-foreground">Include country code (e.g. +91)</p>
                </div>
                <Button
                  onClick={sendPhoneOtp}
                  disabled={phonePending || !phoneNumber}
                  className="w-full"
                >
                  {phonePending ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      <span>Sending OTP...</span>
                    </>
                  ) : (
                    <span>Send Verification Code</span>
                  )}
                </Button>
              </div>
            ) : (
              <div className="grid gap-4">
                <div className="flex flex-col items-center space-y-4">
                  <Label>Verification Code</Label>
                  <InputOTP
                    maxLength={6}
                    value={phoneOtp}
                    onChange={setPhoneOtp}
                  >
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                    </InputOTPGroup>
                    <InputOTPGroup>
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                  <p className="text-xs text-muted-foreground">
                    Code sent to {phoneNumber}
                    <button 
                      onClick={() => { setOtpSent(false); setPhoneOtp(""); }}
                      className="ml-2 text-primary hover:underline font-medium"
                    >
                      Change
                    </button>
                  </p>
                </div>
                <Button
                  onClick={signInWithPhone}
                  disabled={phonePending || phoneOtp.length !== 6}
                  className="w-full"
                >
                  {phonePending ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      <span>Verifying...</span>
                    </>
                  ) : (
                    <span>Sign In with Phone</span>
                  )}
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <div className="relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t after:border-border">
          <span className="relative z-10 bg-card px-2 text-muted-foreground">Or</span>
        </div>

        <div className="flex items-center justify-center gap-5">
          <Button
            disabled={githubPending}
            title="Sign in with GitHub"
            className="h-8 w-8 flex items-center justify-center rounded-full cursor-pointer"
            onClick={signInWithGithub}
          >
            {githubPending ? (
              <Loader className="size-5 animate-spin" />
            ) : (
              <Github className="size-6" />
            )}
          </Button>

          <Button
            disabled={googlePending}
            title="Sign in with Google"
            className="h-8 w-8 flex items-center justify-center rounded-full cursor-pointer"
            onClick={signInWithGoogle}
          >
            {googlePending ? (
              <Loader className="size-5 animate-spin" />
            ) : (
              <GoogleIcon className="size-5" />
            )}
          </Button>
        </div>
        <div className="text-center text-sm">
          Don&apos;t have an account?{" "}
          <Link href="/sign-up" className="underline underline-offset-4 hover:text-primary">
            Sign Up
          </Link>
        </div>
      </CardContent>
    </Card>
  );
};
