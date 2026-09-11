import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@photolib/shared";
import { desc, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

const ALLOWED_PAGE_SIZES: number[] = [25, 50, 100, 200, 250, 500];
const DEFAULT_PAGE_SIZE = 50;

export async function GET(req: NextRequest) {
  const pageSizeParam = req.nextUrl.searchParams.get("pageSize");
  const isAll = pageSizeParam === "all";
  const numericPageSize = Number(pageSizeParam);
  const pageSize = isAll
    ? undefined
    : ALLOWED_PAGE_SIZES.includes(numericPageSize)
      ? numericPageSize
      : DEFAULT_PAGE_SIZE;

  const pageParam = Number(req.nextUrl.searchParams.get("page"));
  const page = Number.isFinite(pageParam) && pageParam >= 1 ? Math.floor(pageParam) : 1;

  const [{ count: totalCount }] = await db.select({ count: sql<number>`count(*)::int` }).from(schema.photos);

  const totalPages = isAll ? 1 : Math.max(1, Math.ceil(totalCount / pageSize!));
  const safePage = isAll ? 1 : Math.min(page, totalPages);

  const rows = isAll
    ? await db.select().from(schema.photos).orderBy(desc(schema.photos.uploadedAt))
    : await db
        .select()
        .from(schema.photos)
        .orderBy(desc(schema.photos.uploadedAt))
        .limit(pageSize!)
        .offset((safePage - 1) * pageSize!);

  return NextResponse.json({
    photos: rows,
    page: safePage,
    pageSize: isAll ? totalCount : pageSize,
    totalCount,
    totalPages,
  });
}
