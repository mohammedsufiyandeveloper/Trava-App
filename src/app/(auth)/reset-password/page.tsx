import { Suspense } from "react";
import { ResetPasswordForm } from "./_components/reset-password-form";
import { AppLoader } from "@/components/shared/app-loader";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<AppLoader />}>
      <ResetPasswordForm />
    </Suspense>
  );
}
