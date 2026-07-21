import { sendPasswordResetEmail } from "@/lib/auth-email";
import {
  authErrorResponse,
  enforceSameOrigin,
  rateLimit,
} from "@/lib/auth-http";
import { createPasswordReset } from "@/lib/auth-store";

export async function POST(request: Request) {
  try {
    enforceSameOrigin(request);
    rateLimit(request, "forgot", 5);
    const body = await request.json();
    const result = await createPasswordReset(String(body.email ?? ""));
    if (result) await sendPasswordResetEmail(result.email, result.token);
    return Response.json(
      {
        ok: true,
        message: "如果这个邮箱已注册，你会收到重置邮件。",
      },
      { status: 202 },
    );
  } catch (error) {
    return authErrorResponse(error);
  }
}
