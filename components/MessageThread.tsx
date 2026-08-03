"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Message } from "@/lib/types";

type MessageWithSender = Message & { sender?: { full_name: string } | null };

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function MessageThread({
  teamAId,
  teamBId,
  senderProfileId,
  senderName,
}: {
  teamAId: string;
  teamBId: string;
  senderProfileId: string;
  senderName: string;
}) {
  const supabase = createClient();
  const [thread, setThread] = useState<MessageWithSender[]>([]);
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      const { data } = await supabase
        .from("messages")
        .select("*, sender:profiles(full_name)")
        .or(
          `and(team_a_id.eq.${teamAId},team_b_id.eq.${teamBId}),and(team_a_id.eq.${teamBId},team_b_id.eq.${teamAId})`
        )
        .order("created_at", { ascending: true });
      if (active) setThread((data as MessageWithSender[]) ?? []);
    }
    load();

    const channel = supabase
      .channel(`messages-${teamAId}-${teamBId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const m = payload.new as Message;
          const belongs =
            (m.team_a_id === teamAId && m.team_b_id === teamBId) ||
            (m.team_a_id === teamBId && m.team_b_id === teamAId);
          if (belongs) {
            const name = m.sender_profile_id === senderProfileId ? senderName : undefined;
            setThread((prev) => [...prev, { ...m, sender: name ? { full_name: name } : null }]);
            // Re-fetch to backfill the sender name if it came from the other team.
            if (!name) load();
          }
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamAId, teamBId, supabase]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread]);

  async function handleSend() {
    if (!draft.trim()) return;
    const body = draft.trim();
    setDraft("");
    await supabase.from("messages").insert({
      team_a_id: teamAId,
      team_b_id: teamBId,
      sender_team_id: teamAId,
      sender_profile_id: senderProfileId,
      body,
    });
  }

  return (
    <div className="border border-line-white rounded-lg bg-rink-2/40 flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {thread.length === 0 && (
          <p className="text-sm text-ice-dim">No messages yet. Say hello.</p>
        )}
        {thread.map((m) => {
          const mine = m.sender_team_id === teamAId;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[75%] rounded-lg px-3 py-2 ${
                  mine ? "bg-faceoff-blue/20 text-ice" : "bg-rink border border-line-white text-ice"
                }`}
              >
                <p className="text-sm">{m.body}</p>
                <p className="text-[11px] text-ice-dim mt-1 font-mono">
                  {m.sender?.full_name ?? "..."} · {fmtTime(m.created_at)}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      <div className="border-t border-line-white p-3 flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Message as your team..."
          className="flex-1 bg-rink border border-line-white rounded-md px-3 py-2 text-sm text-ice placeholder:text-ice-dim/60 outline-none focus:border-faceoff-blue"
        />
        <button
          onClick={handleSend}
          className="px-4 py-2 text-sm font-medium rounded-md bg-faceoff-blue text-ice hover:bg-faceoff-blue/90"
        >
          Send
        </button>
      </div>
    </div>
  );
}
