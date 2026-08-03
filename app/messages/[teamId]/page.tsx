"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/client";
import { Team } from "@/lib/types";
import MessageThread from "@/components/MessageThread";

export default function MessagesThreadPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const supabase = createClient();
  const { team: myTeam, profile } = useAuth();
  const [opponent, setOpponent] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("teams")
      .select("*")
      .eq("id", teamId)
      .maybeSingle()
      .then(({ data }) => {
        setOpponent(data as Team | null);
        setLoading(false);
      });
  }, [teamId, supabase]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center border border-line-white rounded-lg bg-rink-2/20">
        <p className="text-sm text-ice-dim">Loading...</p>
      </div>
    );
  }

  if (!opponent || !myTeam || !profile) {
    return (
      <div className="h-full flex items-center justify-center border border-line-white rounded-lg bg-rink-2/20">
        <p className="text-sm text-ice-dim">Team not found.</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 mb-3">
        <Link href="/messages" className="md:hidden text-ice-dim hover:text-ice p-1 -ml-1">
          ←
        </Link>
        <div>
          <h1 className="font-display text-lg font-semibold">{opponent.short_name}</h1>
          <p className="text-xs text-ice-dim">
            Shared thread — visible to everyone with access on both sides.
          </p>
        </div>
      </div>
      <div className="flex-1 min-h-0">
        <MessageThread
          teamAId={myTeam.id}
          teamBId={opponent.id}
          senderProfileId={profile.id}
          senderName={profile.full_name}
        />
      </div>
    </div>
  );
}
