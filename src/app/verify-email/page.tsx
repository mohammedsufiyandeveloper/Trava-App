"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Mail, AlertCircle, CheckCircle } from "lucide-react";
import { AppLoader } from "@/components/shared/app-loader";

function VerifyEmailContent() {
    const searchParams = useSearchParams();
    const error = searchParams.get("error");
    const [resendStatus, setResendStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

    const handleResendEmail = async () => {
        setResendStatus("loading");

        try {
            // Call Better Auth's resend verification email endpoint
            const response = await fetch("/api/auth/send-verification-email", {
                method: "POST",
            });

            if (response.ok) {
                setResendStatus("success");
            } else {
                setResendStatus("error");
            }
        } catch (err) {
            setResendStatus("error");
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
                {/* Icon */}
                <div className="flex justify-center mb-6">
                    <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center">
                        <Mail className="w-10 h-10 text-blue-600" />
                    </div>
                </div>

                {/* Title */}
                <h1 className="text-3xl font-bold text-center text-gray-900 mb-4">
                    Verify Your Email
                </h1>

                {/* Error Message */}
                {error === "email-not-verified" && (
                    <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="text-sm font-medium text-amber-900">
                                Email Verification Required
                            </p>
                            <p className="text-sm text-amber-700 mt-1">
                                You must verify your email address before accessing your workspace.
                            </p>
                        </div>
                    </div>
                )}

                {/* Main Message */}
                <div className="text-center mb-6">
                    <p className="text-gray-600 mb-4">
                        We've sent a verification email to your inbox. Please check your email and click the verification link to activate your account.
                    </p>

                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                        <p className="text-sm text-blue-900 font-medium mb-2">
                            📧 Check your inbox
                        </p>
                        <p className="text-xs text-blue-700">
                            The email may take a few minutes to arrive. Don't forget to check your spam folder!
                        </p>
                    </div>
                </div>

                {/* Resend Email Button */}
                <div className="space-y-4">
                    <button
                        onClick={handleResendEmail}
                        disabled={resendStatus === "loading" || resendStatus === "success"}
                        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
                    >
                        {resendStatus === "loading" && (
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        )}
                        {resendStatus === "success" ? "Email Sent!" : "Resend Verification Email"}
                    </button>

                    {resendStatus === "success" && (
                        <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
                            <CheckCircle className="w-5 h-5 text-green-600" />
                            <p className="text-sm text-green-800">
                                Verification email sent successfully! Please check your inbox.
                            </p>
                        </div>
                    )}

                    {resendStatus === "error" && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
                            <AlertCircle className="w-5 h-5 text-red-600" />
                            <p className="text-sm text-red-800">
                                Failed to send email. Please try again later.
                            </p>
                        </div>
                    )}

                    {/* Sign Out Link */}
                    <div className="text-center pt-4 border-t border-gray-200">
                        <a
                            href="/api/auth/sign-out"
                            className="text-sm text-gray-600 hover:text-gray-900 underline"
                        >
                            Sign out and use a different account
                        </a>
                    </div>
                </div>

                {/* Help Text */}
                <div className="mt-6 text-center">
                    <p className="text-xs text-gray-500">
                        Having trouble? Contact your workspace administrator for assistance.
                    </p>
                </div>
            </div>
        </div>
    );
}

export default function VerifyEmailPage() {
    return (
        <Suspense fallback={<AppLoader />}>
            <VerifyEmailContent />
        </Suspense>
    );
}
