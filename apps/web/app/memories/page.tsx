import { redirect } from "next/navigation";
import { currentAccount } from "@/lib/server-account";
import { MemoryCenter } from "./memory-center";

export default async function Page() {
  if (!(await currentAccount())) redirect("/login?next=/memories");
  return <MemoryCenter />;
}
