import { redirect } from "next/navigation";
import { currentAccount } from "@/lib/server-account";
import AccountClient from "./account-client";
import "./account.css";

export default async function AccountPage() {
  const account = await currentAccount();
  if (!account) redirect("/login?next=/account");
  return <AccountClient account={account} />;
}
