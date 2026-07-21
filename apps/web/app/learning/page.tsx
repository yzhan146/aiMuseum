import { redirect } from "next/navigation";
import { currentAccount } from "@/lib/server-account";
import { LearningMap } from "./learning-map";

export default async function Page() {
  if (!(await currentAccount())) redirect("/login?next=/learning");
  return <LearningMap />;
}
