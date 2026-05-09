"use client";

import { SessionProvider } from "next-auth/react";
import type { Session } from "next-auth";
import { AuthPromptProvider } from "@/context/AuthPromptContext";

export default function Providers({
  children,
  session,
}: {
  children: React.ReactNode;
  session: Session | null;
}) {
  return (
    <SessionProvider session={session}>
      <AuthPromptProvider>{children}</AuthPromptProvider>
    </SessionProvider>
  );
}
