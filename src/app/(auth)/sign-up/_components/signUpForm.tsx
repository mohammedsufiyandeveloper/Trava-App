"use client"

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { authClient } from '@/lib/auth-client'
import { Loader, Loader2, Send, Github, Eye, EyeOff } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { useTaskCacheStore } from '@/lib/store/task-cache-store'

const GoogleIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

export const SignUpForm = () => {
  const router = useRouter()
  const ensureUser = useTaskCacheStore(state => state.ensureUser)

  const [githubPending, startGithubTransition] = useTransition()
  const [googlePending, startGoogleTransition] = useTransition()
  const [emailPending, startEmailTransition] = useTransition()
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [surname, setSurname] = useState("")
  const [email, setEmail] = useState("")
  const [phoneNumber, setPhoneNumber] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)

  // Generic helper for social signup (GitHub, Google, etc.)
  // verbose social signup (GitHub/Google)
  async function signUpWithGithub() {
    startGithubTransition(async () => {
      await authClient.signIn.social({
        provider: 'github',
        callbackURL: "/",
        fetchOptions: {
          onSuccess: (ctx) => {
            ensureUser(ctx.data.user.id);
            toast.success('Signed in with Github, you will be redirected...')
          },
          onError: (error) => {
            toast.error('Internal server error')
          }
        }
      })
    })
  }

  async function signUpWithGoogle() {
    startGoogleTransition(async () => {
      await authClient.signIn.social({
        provider: 'google',
        callbackURL: "/",
        fetchOptions: {
          onSuccess: (ctx) => {
            ensureUser(ctx.data.user.id);
            toast.success('Signed in with google, you will be redirected...')
          },
          onError: (error) => {
            toast.error('Internal server error')
          }
        }
      })
    })
  }

  // Use standard email/password signup with verification link
  function signUpWithEmail() {
    startEmailTransition(async () => {
      try {
        if (!firstName || !lastName || !surname || !email || !phoneNumber || !password) {
          toast.error("Please fill all fields.");
          return;
        }

        await authClient.signUp.email({
          email,
          password,
          name: `${firstName} ${lastName}`,
          fetchOptions: {
            onSuccess: () => {
              toast.success("Signup successful! Please check your email for a verification link.");
              const query = new URLSearchParams({
                email,
                surname,
                phoneNumber,
                firstName,
                lastName,
                flow: "signup"
              }).toString();
              router.push(`/verify-request?${query}`);
            },
            onError: (ctx: any) => {
              const errorMessage = ctx.error.message || "Signup failed";
              toast.error(errorMessage);
              console.error("Signup error full context:", ctx);
              if (ctx.error) console.error("Signup error details:", JSON.stringify(ctx.error, null, 2));
            },
          },
        });
      } catch (err: any) {
        console.error("Unexpected signup error:", err);
        toast.error(err?.message ?? "Unexpected error");
      }
    });
  }


  return (
    <Card>
      <CardHeader>
        <CardTitle className='text-xl'>
          Welcome!
        </CardTitle>
        <CardDescription>
          Sign up with your Github, Google, or email account
        </CardDescription>
      </CardHeader>

      <CardContent className='flex flex-col gap-4'>
        <div className='grid gap-3'>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="John"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Doe"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="surname">Surname</Label>
              <Input
                id="surname"
                type="text"
                value={surname}
                onChange={(e) => setSurname(e.target.value)}
                placeholder="Smith"
                required
              />
            </div>
          </div>
          <div className='grid gap-2'>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type='email'
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder='your@email.com'
              required
            />
          </div>
          <div className='grid gap-2'>
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              type='tel'
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder='+1234567890'
              required
            />
          </div>
          <div className='grid gap-2'>
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder='Min. 8 characters'
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          <Button
            onClick={signUpWithEmail}
            disabled={emailPending}
          >
            {emailPending ? (
              <>
                <Loader2 className='size-4 animate-spin' />
                <span>Creating Account...</span>
              </>
            ) : (
              <>
                <Send className='size-4' />
                <span>Sign Up & Send Verification Link</span>
              </>
            )}
          </Button>
        </div>

        <div className='relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t after:border-border'>
          <span className='relative z-10 bg-card px-2 text-muted-foreground'>Or</span>
        </div>

        <div className="flex items-center justify-center gap-5">
          {/* GitHub */}
          <Button
            disabled={githubPending}
            title="Sign up with GitHub"
            className="h-8 w-8 flex items-center justify-center rounded-full cursor-pointer"
            onClick={signUpWithGithub}
          >
            {githubPending ? (
              <Loader className="size-5 animate-spin" />
            ) : (
              <Github className="size-6" />
            )}
          </Button>

          {/* Google */}
          <Button
            disabled={googlePending}
            title="Sign up with Google"
            className="h-8 w-8 flex items-center justify-center rounded-full cursor-pointer"
            onClick={signUpWithGoogle}
          >
            {googlePending ? (
              <Loader className="size-5 animate-spin" />
            ) : (
              <GoogleIcon className="size-5" />
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
