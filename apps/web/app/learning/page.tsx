import { redirect } from "next/navigation";
import { currentAccount } from "@/lib/server-account";
import { LearningMap } from "./learning-map";
import { PresenceHeartbeat } from "@/components/PresenceHeartbeat";

export const metadata = { robots: { index: false, follow: false } };

export default async function Page() {
  if (!(await currentAccount())) redirect("/login?next=/learning");
  return <><PresenceHeartbeat /><LearningMap /></>;
}
