import { Suspense } from "react";
import { ForgotPasswordForm } from "./_components/forgot-password-form";
import { AppLoader } from "@/components/shared/app-loader";

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={<AppLoader />}>
      <ForgotPasswordForm />
    </Suspense>
  );
}
