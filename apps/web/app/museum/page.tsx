import { redirect } from "next/navigation";
import { currentAccount } from "@/lib/server-account";
import { Museum } from "./museum";
import { PresenceHeartbeat } from "@/components/PresenceHeartbeat";

export const metadata = { robots: { index: false, follow: false } };

export default async function Page() {
  const account = await currentAccount();
  if (!account) redirect("/login?next=/museum");
  return <><PresenceHeartbeat /><Museum displayName={account.displayName} /></>;
}
