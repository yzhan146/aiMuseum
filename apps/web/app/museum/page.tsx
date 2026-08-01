import { redirect } from "next/navigation";
import { currentAccount } from "@/lib/server-account";
import { Museum } from "./museum";
import { PresenceHeartbeat } from "@/components/PresenceHeartbeat";

export const metadata = { robots: { index: false, follow: false } };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const query = new URLSearchParams();
  const hall = Array.isArray(params.hall) ? params.hall[0] : params.hall;
  const mode = Array.isArray(params.mode) ? params.mode[0] : params.mode;
  if (hall && /^[a-z0-9-]{1,80}$/.test(hall)) query.set("hall", hall);
  if (mode === "child" || mode === "adult") query.set("mode", mode);
  const returnPath = `/museum${query.size ? `?${query.toString()}` : ""}`;
  const account = await currentAccount();
  if (!account) redirect(`/login?next=${encodeURIComponent(returnPath)}`);
  return <><PresenceHeartbeat /><Museum displayName={account.displayName} /></>;
}
