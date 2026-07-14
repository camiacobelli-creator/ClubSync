"use client";

import { useState } from "react";
import { Weekend } from "@/lib/types";

export default function RequestModal({
  weekend,
  opponentName,
  myTeamName,
  onClose,
  onConfirm,
}: {
  weekend: Weekend;
  opponentName: string;
  myTeamName: string;
  onClose: () => void;
  onConfirm: (fromWantsToHost: boolean) => void;
}) {
  const [choice, setChoice] = useState<"host" | "travel">(
    weekend.preference === "home" ? "travel" : "host"
  );

  const date = new Date(weekend.date + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 px-4">
      <div className="bg-rink-2 border border-line-white rounded-xl max-w-md w-full p-6">
        <h2 className="font-display text-lg font-semibold">Request a game</h2>
        <p className="text-sm text-ice-dim mt-1">
          {opponentName} · {date}
        </p>

        <div className="mt-5 space-y-2">
          <p className="text-sm text-ice-dim">{myTeamName} would:</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setChoice("host")}
              className={`rounded-md border px-3 py-2 text-sm font-medium ${
                choice === "host"
                  ? "border-faceoff-blue bg-faceoff-blue/10 text-ice"
                  : "border-line-white text-ice-dim hover:border-ice-dim"
              }`}
            >
              Host {opponentName}
            </button>
            <button
              onClick={() => setChoice("travel")}
              className={`rounded-md border px-3 py-2 text-sm font-medium ${
                choice === "travel"
                  ? "border-faceoff-blue bg-faceoff-blue/10 text-ice"
                  : "border-line-white text-ice-dim hover:border-ice-dim"
              }`}
            >
              Travel to {opponentName}
            </button>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-ice-dim hover:text-ice"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(choice === "host")}
            className="px-4 py-2 text-sm font-medium rounded-md bg-board-red text-ice hover:bg-board-red/90"
          >
            Send request
          </button>
        </div>
      </div>
    </div>
  );
}
