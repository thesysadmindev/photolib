import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: { signIn: "/admin/login" },
});

export const config = {
  // Excludes /admin/login so the login page itself isn't gated (would loop otherwise).
  matcher: ["/admin/((?!login).*)", "/api/admin/:path*"],
};
