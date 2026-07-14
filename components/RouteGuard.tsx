"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";

const exempt = ["/login", "/signup", "/onboarding", "/welcome", "/forgot-password", "/reset-password"];

export default function RouteGuard({ children }: { children: React.ReactNode }) {
  const { loading, userId, profile } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!userId) return; // middleware handles unauthenticated redirects
    if (
      !profile?.team_id &&
      !profile?.is_commissioner &&
      !exempt.includes(pathname) &&
      !pathname.startsWith("/join/")
    ) {
      router.push("/onboarding");
    }
  }, [loading, userId, profile, pathname, router]);

  return <>{children}</>;
}
