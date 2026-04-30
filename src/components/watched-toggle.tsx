"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { toggleWatched } from "@/app/actions/videos";

export function WatchedToggle({
  videoId,
  initialWatched,
  labels,
}: {
  videoId: number;
  initialWatched: boolean;
  labels: { mark: string; unmark: string };
}) {
  const [watched, setWatched] = useState(initialWatched);
  const [pending, startTransition] = useTransition();

  function onClick() {
    startTransition(async () => {
      const r = await toggleWatched(videoId);
      if (r.ok) {
        setWatched(r.watched);
      } else {
        toast.error(r.error);
      }
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className={watched ? "btn-ghost" : "btn-coral"}
      style={{
        padding: "10px 20px",
        fontSize: "0.85rem",
      }}
    >
      {pending
        ? "..."
        : watched
          ? `✓ ${labels.unmark}`
          : labels.mark}
    </button>
  );
}
