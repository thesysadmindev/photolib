"use client";

import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button className="btn btn-secondary btn-sm" onClick={() => signOut({ callbackUrl: "/admin/login" })}>
      Sign out
    </button>
  );
}
