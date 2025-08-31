"use client";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";

export function SignOutButton() {
  const { isAuthenticated } = useConvexAuth();
  const { signOut } = useAuthActions();

  if (!isAuthenticated) {
    return null;
  }

  return (
    <button
      className="px-4 py-2 rounded-xl bg-white text-brand-dark border border-gray-200 font-semibold hover:bg-brand-light hover:text-brand-dark transition-colors shadow-sm hover:shadow"
      onClick={() => void signOut()}
    >
      Uitloggen
    </button>
  );
}
