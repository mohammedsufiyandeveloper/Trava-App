'use client'

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"
import { authClient } from "@/lib/auth-client"
import { Loader2 } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"
import { useTaskCacheStore } from "@/lib/store/task-cache-store";
import { syncUserProfile } from "@/app/actions/user"

export default function VerifyRequestClient() {
  const router = useRouter();
  const ensureUser = useTaskCacheStore(state => state.ensureUser);
  const [otp, setOtp] = useState("");
  const [emailPending, startTransition] = useTransition();
  const params = useSearchParams();
  const email = params?.get("email") ?? "";
  const phoneNumber = params?.get("phoneNumber") ?? "";
  const firstName = params?.get("firstName") ?? "";
  const lastName = params?.get("lastName") ?? "";
  const surname = params?.get("surname") ?? "";
  const flow = params?.get("flow") ?? "";
  const isOtpCompleted = otp.length === 6;

  const verifyOtp = () => {
    startTransition(async () => {
      // Use Phone verification ONLY for direct phone login (not signup)
      if (phoneNumber && !email && flow !== "signup") {
        await authClient.phoneNumber.verify({
          phoneNumber,
          code: otp,
          fetchOptions: {
            onSuccess: async (ctx) => {
              ensureUser(ctx.data.user.id);
              toast.success('Signed In')
              window.location.href = "/"
            },
            onError: (ctx: any) => {
              toast.error(ctx.error.message || "Error verifying phone/OTP")
            }
          }
        })
      } else {
        // Use Email OTP for signup and general email verification
        await authClient.emailOtp.verifyEmail({
          email,
          otp,
          fetchOptions: {
            onSuccess: async (ctx) => {
              // If it's a signup flow, sync all the captured details using Raw SQL
              // to bypass Prisma Client validation errors
              try {
                if (flow === "signup" || (phoneNumber || surname)) {
                  await syncUserProfile({
                    userId: ctx.data.user.id,
                    surname,
                    phoneNumber,
                  });
                }
              } catch (syncError: any) {
                console.error("Profile sync error:", syncError);
                toast.error("Account verified but profile details could not be updated. You can update them in settings.");
              }
              
              ensureUser(ctx.data.user.id);
              toast.success('Account Verified')
              window.location.href = "/"
            },
            onError: (ctx: any) => {
              toast.error(ctx.error.message || "Error verifying email/OTP")
            }
          }
        })
      }
    })
  }

  return (
    <Card className="w-full mx-auto">
      <CardHeader className="text-center">
        <CardTitle className="text-xl">
          {!phoneNumber ? "Check your email" : "Verify OTP"}
        </CardTitle>
        <CardDescription>
          {!phoneNumber 
            ? "We have sent a verification link to your email address. Please click the link to verify your account."
            : "We have sent a 6-digit verification code to your phone. Please enter it below to sign in."
          }
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {phoneNumber && (
          <div className="flex flex-col items-center space-y-2">
            <InputOTP
              maxLength={6}
              className="gap-2"
              value={otp}
              onChange={(value) => setOtp(value)}
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
            <p className="text-sm text-muted-foreground">Enter the 6 digit code sent to your phone</p>
          </div>
        )}

        {phoneNumber ? (
          <Button className="w-full" onClick={verifyOtp} disabled={emailPending || !isOtpCompleted}>
            {emailPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                <span>Verifying...</span>
              </>
            ) : "Verify & Sign In"}
          </Button>
        ) : (
          <div className="text-center text-sm text-muted-foreground pt-4">
            Didn't receive the email? Check your spam folder or contact support.
          </div>
        )}
      </CardContent>
    </Card>
  )
}
