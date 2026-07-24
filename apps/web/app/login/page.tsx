import { redirect } from "next/navigation";
import { AuthFrame } from "../auth-frame";
import "../account/account.css";
import "./login.css";
import { currentAccount, safeReturnPath } from "@/lib/server-account";
import { localTestAccountCredentials } from "@/lib/auth-store";
import LoginClient from "./login-client";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const next = safeReturnPath(params.next);
  if (await currentAccount()) redirect(next);
  const testAccount = localTestAccountCredentials();
  return (
    <AuthFrame eyebrow="账户登录" title="欢迎回来" description="继续你保存的人物对话与历史旅程。">
      <LoginClient
        next={next}
        verificationFailed={params.verification === "failed"}
        testAccount={testAccount ?? undefined}
      />
    </AuthFrame>
  );
}
