import { sendVerificationEmail } from "@/lib/auth-email";
import {
  authErrorResponse,
  enforceSameOrigin,
  rateLimit,
} from "@/lib/auth-http";
import { registerAccount } from "@/lib/auth-store";

export async function POST(request: Request) {
  try {
    enforceSameOrigin(request);
    rateLimit(request, "register", 5);
    const body = await request.json();
    const result = await registerAccount(body);
    if (result.created) {
      await sendVerificationEmail(result.email, result.token);
    }
    return Response.json(
      {
        ok: true,
        message: "如果这个邮箱可以注册，你会收到验证邮件。",
      },
      { status: 202 },
    );
  } catch (error) {
    return authErrorResponse(error);
  }
}
