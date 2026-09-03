import "./env.js"; // must be first: loads root .env before @photolib/shared reads process.env

import bcrypt from "bcryptjs";
import { db, schema } from "@photolib/shared";
import { eq } from "drizzle-orm";

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.error("Set ADMIN_EMAIL and ADMIN_PASSWORD env vars before running this script.");
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const [existing] = await db
    .select({ id: schema.adminUsers.id })
    .from(schema.adminUsers)
    .where(eq(schema.adminUsers.email, email))
    .limit(1);

  if (existing) {
    await db
      .update(schema.adminUsers)
      .set({ passwordHash })
      .where(eq(schema.adminUsers.id, existing.id));
    console.log(`Updated password for existing admin: ${email}`);
  } else {
    await db.insert(schema.adminUsers).values({ email, passwordHash });
    console.log(`Created admin user: ${email}`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
