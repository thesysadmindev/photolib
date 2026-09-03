import type { NextRequest } from "next/server";

/**
 * Resolves the real client IP from X-Forwarded-For.
 *
 * This is only safe because of the deployment topology (see infra/setup.md):
 * the Next.js process binds to 127.0.0.1 and the VPS firewall blocks direct
 * external access to its port, so every request that reaches this process
 * necessarily passed through the nginx reverse proxy, which is configured
 * (proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for) to set
 * X-Forwarded-For to the real client IP. If that topology ever changes
 * (e.g. the app is ever exposed directly, or a different/untrusted proxy is
 * added in front), this header can no longer be trusted as-is.
 */
export function getClientIp(req: NextRequest): string {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]!.trim();
  }
  return "0.0.0.0";
}
