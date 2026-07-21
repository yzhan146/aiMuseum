import { AuthFrame } from "../auth-frame";
import "../account/account.css";
import ForgotPasswordClient from "./forgot-password-client";

export default function ForgotPasswordPage() {
  return (
    <AuthFrame eyebrow="账户恢复" title="找回密码" description="输入注册邮箱，我们会发送一条30分钟内有效的重置链接。">
      <ForgotPasswordClient />
    </AuthFrame>
  );
}
