import { NextResponse } from "next/server";
import { db, schema } from "@photolib/shared";
import { desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await db
    .select()
    .from(schema.photos)
    .orderBy(desc(schema.photos.uploadedAt))
    .limit(200);

  return NextResponse.json({ photos: rows });
}
