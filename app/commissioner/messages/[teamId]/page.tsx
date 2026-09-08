"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/client";
import { Team } from "@/lib/types";
import CommissionerMessageThread from "@/components/CommissionerMessageThread";

export default function CommissionerMessageThreadPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const supabase = createClient();
  const { profile } = useAuth();
  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("teams")
      .select("*")
      .eq("id", teamId)
      .maybeSingle()
      .then(({ data }) => {
        setTeam(data as Team | null);
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

  if (!team || !profile) {
    return (
      <div className="h-full flex items-center justify-center border border-line-white rounded-lg bg-rink-2/20">
        <p className="text-sm text-ice-dim">Team not found.</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="mb-3">
        <h1 className="font-display text-lg font-semibold">{team.short_name}</h1>
        <p className="text-xs text-ice-dim">Direct thread between you and this team.</p>
      </div>
      <div className="flex-1 min-h-0">
        <CommissionerMessageThread
          commissionerId={profile.id}
          teamId={team.id}
          senderRole="commissioner"
          senderProfileId={profile.id}
          senderName={profile.full_name}
        />
      </div>
    </div>
  );
}
