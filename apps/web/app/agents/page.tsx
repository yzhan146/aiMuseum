import { redirect } from "next/navigation";
import { currentAccount } from "@/lib/server-account";
import { AgentConsole } from "./agent-console";

export default async function Page() {
  if (!(await currentAccount())) redirect("/login?next=/agents");
  return <AgentConsole />;
}
