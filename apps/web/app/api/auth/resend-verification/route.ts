import { sendVerificationEmail } from "@/lib/auth-email";
import {
  authErrorResponse,
  enforceSameOrigin,
  rateLimit,
} from "@/lib/auth-http";
import { resendVerification } from "@/lib/auth-store";

export async function POST(request: Request) {
  try {
    enforceSameOrigin(request);
    rateLimit(request, "resend", 4);
    const body = await request.json();
    const result = await resendVerification(String(body.email ?? ""));
    if (result) await sendVerificationEmail(result.email, result.token);
    return Response.json(
      {
        ok: true,
        message: "如果邮箱已注册且尚未验证，你会收到新的验证邮件。",
      },
      { status: 202 },
    );
  } catch (error) {
    return authErrorResponse(error);
  }
}
