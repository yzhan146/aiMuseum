import { redirect } from "next/navigation";
import { currentAccount } from "@/lib/server-account";
import { Museum } from "./museum";

export default async function Page() {
  const account = await currentAccount();
  if (!account) redirect("/login?next=/museum");
  return <Museum displayName={account.displayName} />;
}
