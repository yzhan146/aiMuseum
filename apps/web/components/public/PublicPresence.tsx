"use client";

import { useEffect, useState } from "react";

type PublicPresenceResponse = {
  onlineLabel: string | null;
  updatedAt?: string;
};

export function PublicPresence() {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const refresh = () => {
      void fetch("/api/public/presence", { signal: controller.signal })
        .then(async (response) => {
          if (!response.ok) return null;
          return (await response.json()) as PublicPresenceResponse;
        })
        .then((result) => setLabel(result?.onlineLabel ?? null))
        .catch(() => undefined);
    };
    refresh();
    const timer = setInterval(refresh, 60_000);
    return () => {
      clearInterval(timer);
      controller.abort();
    };
  }, []);

  if (!label) return null;
  return <span className="public-presence">{label} 位探索者正在馆内</span>;
}
