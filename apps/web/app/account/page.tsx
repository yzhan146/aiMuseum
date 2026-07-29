import { redirect } from "next/navigation";
import { currentAccount } from "@/lib/server-account";
import AccountClient from "./account-client";
import "./account.css";
import { PresenceHeartbeat } from "@/components/PresenceHeartbeat";
import { isMetricsAdmin } from "@/lib/operational-metrics";

export const metadata = { robots: { index: false, follow: false } };

export default async function AccountPage() {
  const account = await currentAccount();
  if (!account) redirect("/login?next=/account");
  return <><PresenceHeartbeat /><AccountClient account={account} metricsAdmin={isMetricsAdmin(account)} /></>;
}
