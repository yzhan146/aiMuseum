import { redirect } from "next/navigation";
import { AuthFrame } from "../auth-frame";
import "../account/account.css";
import { currentAccount, safeReturnPath } from "@/lib/server-account";
import RegisterClient from "./register-client";

export const metadata = { title: "注册", robots: { index: false, follow: false } };

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const next = safeReturnPath((await searchParams).next);
  if (await currentAccount()) redirect(next);
  return (
    <AuthFrame eyebrow="新访客登记" title="创建账户" description="只需要昵称、邮箱和密码。验证邮箱后即可进入博物馆。">
      <RegisterClient next={next} />
    </AuthFrame>
  );
}
