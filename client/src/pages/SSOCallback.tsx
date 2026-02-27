import { AuthenticateWithRedirectCallback } from "@clerk/clerk-react";

export default function SSOCallback() {
  return (
    <AuthenticateWithRedirectCallback
      afterSignInUrl="/auth-callback"
      afterSignUpUrl="/auth-callback"
    />
  );
}
