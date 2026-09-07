"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { CommissionerMessage } from "@/lib/types";

type MessageWithSender = CommissionerMessage & { sender?: { full_name: string } | null };

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function CommissionerMessageThread({
  commissionerId,
  teamId,
  senderRole,
  senderProfileId,
  senderName,
}: {
  commissionerId: string;
  teamId: string;
  senderRole: "commissioner" | "team";
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
        .from("commissioner_messages")
        .select("*, sender:profiles(full_name)")
        .eq("commissioner_id", commissionerId)
        .eq("team_id", teamId)
        .order("created_at", { ascending: true });
      if (active) setThread((data as MessageWithSender[]) ?? []);
    }
    load();

    const channel = supabase
      .channel(`commissioner-messages-${commissionerId}-${teamId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "commissioner_messages" },
        (payload) => {
          const m = payload.new as CommissionerMessage;
          if (m.commissioner_id === commissionerId && m.team_id === teamId) {
            const name = m.sender_profile_id === senderProfileId ? senderName : undefined;
            setThread((prev) => [...prev, { ...m, sender: name ? { full_name: name } : null }]);
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
  }, [commissionerId, teamId, supabase]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread]);

  async function handleSend() {
    if (!draft.trim()) return;
    const body = draft.trim();
    setDraft("");
    await supabase.from("commissioner_messages").insert({
      commissioner_id: commissionerId,
      team_id: teamId,
      sender_role: senderRole,
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
          const mine = m.sender_role === senderRole;
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
          placeholder={senderRole === "commissioner" ? "Message this team..." : "Message the commissioner..."}
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
