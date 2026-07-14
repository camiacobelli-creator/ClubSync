"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/client";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/calendar", label: "Calendar" },
  { href: "/team", label: "Team Profile" },
  { href: "/teams", label: "Browse Teams" },
  { href: "/requests", label: "Requests" },
  { href: "/messages", label: "Messages" },
];

const commissionerLinks = [
  { href: "/commissioner", label: "League Schedule" },
  { href: "/teams", label: "Browse Teams" },
];

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const { team, profile, signOut } = useAuth();
  const [pendingCount, setPendingCount] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!team) return;
    supabase
      .from("game_requests")
      .select("id", { count: "exact", head: true })
      .eq("to_team_id", team.id)
      .eq("status", "pending")
      .then(({ count }) => setPendingCount(count ?? 0));
  }, [team, supabase, pathname]);

  useEffect(() => {
    if (!team) return;
    Promise.all([
      supabase
        .from("messages")
        .select("id, sender_team_id, created_at, team_a_id, team_b_id")
        .or(`team_a_id.eq.${team.id},team_b_id.eq.${team.id}`)
        .neq("sender_team_id", team.id),
      supabase.from("message_reads").select("other_team_id, last_read_at").eq("team_id", team.id),
    ]).then(([m, r]) => {
      const reads: Record<string, string> = {};
      (r.data ?? []).forEach((row) => (reads[row.other_team_id] = row.last_read_at));
      const unread = (m.data ?? []).filter((msg) => {
        const otherId = msg.team_a_id === team.id ? msg.team_b_id : msg.team_a_id;
        const lastRead = reads[otherId];
        return !lastRead || msg.created_at > lastRead;
      }).length;
      setUnreadCount(unread);
    });
  }, [team, supabase, pathname]);

  const activeLinks = profile?.is_commissioner ? commissionerLinks : links;

  if (pathname === "/welcome") {
    return (
      <header className="border-b border-line-white sticky top-0 z-20 bg-rink/95 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
          <span className="font-display text-xl font-semibold tracking-wide">
            Club<span className="text-faceoff-blue">Sync</span>
          </span>
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="px-4 py-2 text-sm font-medium text-ice-dim hover:text-ice"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="px-4 py-2 text-sm font-medium rounded-md bg-faceoff-blue text-ice hover:bg-faceoff-blue/90"
            >
              Sign up
            </Link>
          </div>
        </div>
      </header>
    );
  }

  const authFormPaths = ["/login", "/signup", "/onboarding", "/forgot-password", "/reset-password"];
  if (authFormPaths.includes(pathname)) {
    return (
      <header className="border-b border-line-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center">
          <span className="font-display text-xl font-semibold tracking-wide">
            Club<span className="text-faceoff-blue">Sync</span>
          </span>
        </div>
      </header>
    );
  }

  return (
    <header className="border-b border-line-white sticky top-0 z-20 bg-rink/95 backdrop-blur">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
        <Link href={profile?.is_commissioner ? "/commissioner" : "/"} className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-faceoff-blue inline-block" />
          <span className="font-display text-xl font-semibold tracking-wide">
            Club<span className="text-faceoff-blue">Sync</span>
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {activeLinks.map((l) => (
            <NavLink
              key={l.href}
              href={l.href}
              pathname={pathname}
              badgeCount={l.href === "/requests" ? pendingCount : l.href === "/messages" ? unreadCount : 0}
            />
          ))}
          {profile && (
            <button
              onClick={async () => {
                await signOut();
                router.push("/login");
              }}
              className="ml-2 px-3 py-2 text-sm text-ice-dim hover:text-ice"
            >
              Log out
            </button>
          )}
        </nav>

        {/* Mobile hamburger */}
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="md:hidden p-2 text-ice-dim hover:text-ice"
          aria-label="Toggle menu"
        >
          {menuOpen ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M6 18L18 6" strokeLinecap="round" />
            </svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile menu panel */}
      {menuOpen && (
        <nav className="md:hidden border-t border-line-white bg-rink px-4 py-3 space-y-1">
          {activeLinks.map((l) => (
            <NavLink
              key={l.href}
              href={l.href}
              pathname={pathname}
              badgeCount={l.href === "/requests" ? pendingCount : l.href === "/messages" ? unreadCount : 0}
              block
            />
          ))}
          {profile && (
            <button
              onClick={async () => {
                await signOut();
                router.push("/login");
              }}
              className="w-full text-left px-3 py-2 text-sm text-ice-dim hover:text-ice"
            >
              Log out
            </button>
          )}
        </nav>
      )}
    </header>
  );
}

function NavLink({
  href,
  pathname,
  badgeCount,
  block,
}: {
  href: string;
  pathname: string;
  badgeCount: number;
  block?: boolean;
}) {
  const labelMap: Record<string, string> = {
    "/": "Dashboard",
    "/calendar": "Calendar",
    "/team": "Team Profile",
    "/teams": "Browse Teams",
    "/requests": "Requests",
    "/messages": "Messages",
    "/commissioner": "League Schedule",
  };
  const active = pathname === href || (href === "/messages" && pathname.startsWith("/messages"));
  return (
    <Link
      href={href}
      className={`relative px-3 py-2 text-sm font-medium rounded-md transition-colors ${
        block ? "block" : ""
      } ${active ? "text-ice bg-rink-2" : "text-ice-dim hover:text-ice hover:bg-rink-2/60"}`}
    >
      {labelMap[href] ?? href}
      {badgeCount > 0 && (
        <span className="absolute top-1.5 right-2 md:-top-1 md:-right-1 bg-board-red text-ice text-[10px] leading-none rounded-full w-4 h-4 flex items-center justify-center font-mono">
          {badgeCount}
        </span>
      )}
    </Link>
  );
}
