"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import Logo from "@/assets/logo.png";
import { buttonVariants } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import ThemeToggle from "@/components/ui/theme-toggle";
import { UserDropdown } from "./userDropdown";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface iAppProps {
  session?: any; // Optional session from server
}

export function Navbar({ session: serverSession }: iAppProps) {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();

  // Use client session if available, otherwise use server session
  const currentSession = session || serverSession;

  // Protected click handler for Workspace link
  const handleWorkspaceClick = (e: React.MouseEvent) => {
    e.preventDefault();

    if (isPending) {
      toast("Checking session...");
      return;
    }

    if (!currentSession) {
      toast.error("Please login to access your workspace");
      router.push("/sign-in?next=/workspace");
      return;
    }
    router.push("/w");
  };

  return (
    <header className="sticky top-0 z-50 w-full border bg-background/95 backdrop-blur-[backdrop-filter]:bg-background/60">
      <div className="container flex min-h-16 items-center mx-auto px-4 md:px-6 lg:px-8">
        <Link href="/" className="flex items-center space-x-2 mr-2 sm:mr-4">
          <Image src={Logo} alt="Logo" width={120} height={40} className="p-2 sm:p-3 sm:w-[150px]" />
        </Link>

        {/* desktop navigation */}
        <nav className="hidden md:flex md:flex-1 md:items-center md:justify-between">
          <div className="flex items-center space-x-6">
            <Link href="/" className="text-sm font-medium transition-colors hover:text-primary">
              Home
            </Link>

            <a
              href="/w"
              onClick={handleWorkspaceClick}
              className="text-sm font-medium transition-colors hover:text-primary cursor-pointer"
            >
              Workspace
            </a>
          </div>

          <div className="flex items-center space-x-4">
            <ThemeToggle />

            {isPending ? null : session ? (
              <UserDropdown
                email={session.user.email}
                image={session?.user.image || ""}
                name={
                  session?.user.name && session?.user.name.length > 0
                    ? session?.user.name
                    : session?.user.email.split("@")[0]
                }
              />
            ) : (
              <>
                <Link href="/sign-in" className={buttonVariants({ variant: "secondary" })}>
                  Login
                </Link>
                <Link href="/sign-in" className={buttonVariants()}>
                  Get Started
                </Link>
              </>
            )}
          </div>
        </nav>

        {/* mobile / small screens: simple layout (optional) */}
        <nav className="flex md:hidden flex-1 items-center justify-end gap-3">
          <ThemeToggle />
          {isPending ? null : session ? (
            <UserDropdown
              email={session.user.email}
              image={session?.user.image || ""}
              name={
                session?.user.name && session?.user.name.length > 0
                  ? session?.user.name
                  : session?.user.email.split("@")[0]
              }
            />
          ) : (
            <>
              <Link href="/sign-in" className={buttonVariants({ variant: "secondary" })}>
                Login
              </Link>
              <Link href="/sign-in" className={buttonVariants()}>
                Get Started
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
};

export default Navbar;
