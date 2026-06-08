import { createAuthClient } from "better-auth/react"
import { emailOTPClient, adminClient, phoneNumberClient } from "better-auth/client/plugins"

export const authClient = createAuthClient({
  plugins: [
    emailOTPClient(),
    adminClient(),
    phoneNumberClient(),
  ]
})
