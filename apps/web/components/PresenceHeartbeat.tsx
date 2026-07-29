"use client";

import { useEffect } from "react";

const HEARTBEAT_MS = 60_000;

export function PresenceHeartbeat() {
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;

    const beat = () => {
      if (document.visibilityState !== "visible") return;
      void fetch("/api/presence/heartbeat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
        keepalive: true,
      }).catch(() => undefined);
    };

    const start = () => {
      if (timer) clearInterval(timer);
      if (document.visibilityState !== "visible") return;
      beat();
      timer = setInterval(beat, HEARTBEAT_MS);
    };

    const onVisibility = () => start();
    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      if (timer) clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return null;
}
