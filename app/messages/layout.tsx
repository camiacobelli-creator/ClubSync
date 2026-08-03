"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/client";
import { Team, Message, MessageRead } from "@/lib/types";

type ConversationInfo = {
  team: Team;
  lastMessage: Message | null;
  unread: number;
};

export default function MessagesLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const pathname = usePathname();
  const { team: myTeam } = useAuth();
  const [conversations, setConversations] = useState<ConversationInfo[]>([]);
  const [otherTeams, setOtherTeams] = useState<Team[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  const activeTeamId = pathname.startsWith("/messages/")
    ? pathname.split("/messages/")[1]
    : null;

  function load() {
    if (!myTeam) return;
    Promise.all([
      supabase.from("teams").select("*").neq("id", myTeam.id).order("short_name"),
      supabase
        .from("messages")
        .select("*")
        .or(`team_a_id.eq.${myTeam.id},team_b_id.eq.${myTeam.id}`)
        .order("created_at", { ascending: false }),
      supabase.from("message_reads").select("*").eq("team_id", myTeam.id),
    ]).then(([t, m, r]) => {
      const teams = (t.data as Team[]) ?? [];
      const messages = (m.data as Message[]) ?? [];
      const reads = (r.data as MessageRead[]) ?? [];
      const readMap: Record<string, string> = {};
      reads.forEach((row) => (readMap[row.other_team_id] = row.last_read_at));

      const lastByTeam: Record<string, Message> = {};
      const unreadByTeam: Record<string, number> = {};
      messages.forEach((msg) => {
        const otherId = msg.team_a_id === myTeam.id ? msg.team_b_id : msg.team_a_id;
        if (!lastByTeam[otherId]) lastByTeam[otherId] = msg;
        const lastRead = readMap[otherId];
        if (
          msg.sender_team_id !== myTeam.id &&
          (!lastRead || msg.created_at > lastRead)
        ) {
          unreadByTeam[otherId] = (unreadByTeam[otherId] ?? 0) + 1;
        }
      });

      const withConvo = teams
        .filter((t) => lastByTeam[t.id])
        .map((t) => ({ team: t, lastMessage: lastByTeam[t.id], unread: unreadByTeam[t.id] ?? 0 }))
        .sort((a, b) => b.lastMessage!.created_at.localeCompare(a.lastMessage!.created_at));

      setConversations(withConvo);
      setOtherTeams(teams.filter((t) => !lastByTeam[t.id]));
      setLoading(false);
    });
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myTeam, supabase]);

  // Realtime: refresh the list whenever a new message involving us arrives.
  useEffect(() => {
    if (!myTeam) return;
    const channel = supabase
      .channel(`messages-list-${myTeam.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const m = payload.new as Message;
          if (m.team_a_id === myTeam.id || m.team_b_id === myTeam.id) load();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myTeam, supabase]);

  // Mark the active thread as read whenever we navigate into it.
  useEffect(() => {
    if (!myTeam || !activeTeamId) return;
    supabase
      .from("message_reads")
      .upsert(
        { team_id: myTeam.id, other_team_id: activeTeamId, last_read_at: new Date().toISOString() },
        { onConflict: "team_id,other_team_id" }
      )
      .then(() => load());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTeamId, myTeam, supabase]);

  const filteredOthers = otherTeams.filter((t) =>
    t.short_name.toLowerCase().includes(query.toLowerCase())
  );

  const showListOnMobile = !activeTeamId;

  return (
    <div className="grid md:grid-cols-[300px_1fr] gap-6 h-[calc(100vh-8rem)] min-h-[500px]">
      <div
        className={`${showListOnMobile ? "block" : "hidden"} md:block border border-line-white rounded-lg bg-rink-2/40 overflow-hidden flex flex-col`}
      >
        <div className="p-3 border-b border-line-white">
          <h1 className="font-display text-lg font-semibold mb-2">Messages</h1>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a team..."
            className="w-full bg-rink border border-line-white rounded-md px-3 py-1.5 text-sm outline-none focus:border-faceoff-blue"
          />
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <p className="text-sm text-ice-dim p-3">Loading...</p>
          ) : (
            <>
              {conversations
                .filter((c) => c.team.short_name.toLowerCase().includes(query.toLowerCase()))
                .map((c) => (
                  <Link
                    key={c.team.id}
                    href={`/messages/${c.team.id}`}
                    className={`block px-3 py-3 border-b border-line-white/50 hover:bg-rink-2 ${
                      activeTeamId === c.team.id ? "bg-rink-2" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium truncate">{c.team.short_name}</p>
                      {c.unread > 0 && (
                        <span className="bg-board-red text-ice text-[10px] leading-none rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center font-mono shrink-0">
                          {c.unread}
                        </span>
                      )}
                    </div>
                    <p
                      className={`text-xs mt-0.5 truncate ${
                        c.unread > 0 ? "text-ice" : "text-ice-dim"
                      }`}
                    >
                      {c.lastMessage?.body}
                    </p>
                  </Link>
                ))}

              {filteredOthers.length > 0 && (
                <div className="px-3 pt-3 pb-1">
                  <p className="text-[10px] uppercase tracking-widest text-ice-dim/60 font-mono">
                    Start a conversation
                  </p>
                </div>
              )}
              {filteredOthers.map((t) => (
                <Link
                  key={t.id}
                  href={`/messages/${t.id}`}
                  className={`block px-3 py-2.5 hover:bg-rink-2 ${
                    activeTeamId === t.id ? "bg-rink-2" : ""
                  }`}
                >
                  <p className="text-sm text-ice-dim">{t.short_name}</p>
                </Link>
              ))}

              {conversations.length === 0 && filteredOthers.length === 0 && (
                <p className="text-sm text-ice-dim p-3">No teams to message yet.</p>
              )}
            </>
          )}
        </div>
      </div>

      <div className={`${showListOnMobile ? "hidden" : "block"} md:block min-h-0`}>{children}</div>
    </div>
  );
}
