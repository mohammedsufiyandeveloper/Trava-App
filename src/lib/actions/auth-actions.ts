"use server";
import 'server-only'
import { auth } from "../auth";
import { headers } from "next/headers";

export const signUp = async (email: string, password: string, name: string) => {
    // Implement your sign-up logic here, e.g., save to database
    const result = await auth.api.signUpEmail({
        body: {
            email, password, name, callbackURL: "/dashboard"
        }
    });
    // console.log("Signing up user:", { email, password, name });
    return result;
};

export const signIn = async (email: string, password: string) => {
    const result = await auth.api.signInEmail({
        body: {
            email,
            password,
        }
    });
    // console.log("Signing up user:", { email, password });
    return result;
};

export const signOut = async () => {
    // Implement your sign-up logic here, e.g., save to database
    const result = await auth.api.signOut({ headers: await headers() });
    console.log("Sigouting out user");
    return result;
};

export const forgetPassword = async (email: string) => {
    // Function to handle password reset
    const result = await auth.api.forgetPassword({
        body: {
            email,
            redirectTo: "/reset-password",
        }
    });
    return result;
}

export const ResetPassword = async ({ newPassword, token }: { newPassword: string; token: string }) => {
    // Function to handle password reset
    const result = await auth.api.resetPassword({
        body: {
            newPassword,
            token,
        }
    });
    return result;
}
