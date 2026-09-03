import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { db, schema } from "@photolib/shared";
import { desc, eq, sql } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { generateUniqueAlbumSlug } from "@/lib/albumSlug";

export const dynamic = "force-dynamic";

export async function GET() {
  const albumRows = await db.select().from(schema.albums).orderBy(desc(schema.albums.createdAt));

  const counts = await db
    .select({ albumId: schema.photoAlbums.albumId, count: sql<number>`count(*)::int` })
    .from(schema.photoAlbums)
    .groupBy(schema.photoAlbums.albumId);
  const countByAlbum = new Map(counts.map((c) => [c.albumId, c.count]));

  return NextResponse.json({
    albums: albumRows.map((a) => ({ ...a, photoCount: countByAlbum.get(a.id) ?? 0 })),
  });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const slug = await generateUniqueAlbumSlug(name);

  const [album] = await db
    .insert(schema.albums)
    .values({
      name,
      slug,
      description: typeof body.description === "string" && body.description ? body.description : null,
      isPublic: body.isPublic !== false,
      createdBy: session.user.id as string,
    })
    .returning();

  return NextResponse.json({ album }, { status: 201 });
}
