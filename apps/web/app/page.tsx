import { redirect } from "next/navigation";
import { currentAccount } from "@/lib/server-account";

export default async function Home() {
  redirect((await currentAccount()) ? "/museum" : "/login");
}
