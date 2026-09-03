import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@photolib/shared";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();

  const updates: Partial<typeof schema.albums.$inferInsert> = {};
  if (typeof body.name === "string" && body.name.trim()) updates.name = body.name.trim();
  if (typeof body.description === "string") updates.description = body.description || null;
  if (typeof body.isPublic === "boolean") updates.isPublic = body.isPublic;
  if (typeof body.coverPhotoId === "string" || body.coverPhotoId === null) {
    updates.coverPhotoId = body.coverPhotoId;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  await db.update(schema.albums).set(updates).where(eq(schema.albums.id, params.id));

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  await db.delete(schema.albums).where(eq(schema.albums.id, params.id));
  return NextResponse.json({ ok: true });
}
