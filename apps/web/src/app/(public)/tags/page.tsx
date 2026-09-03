import Link from "next/link";
import { db, schema } from "@photolib/shared";
import { and, eq, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

async function getTags() {
  return db
    .select({
      id: schema.tags.id,
      name: schema.tags.name,
      slug: schema.tags.slug,
      count: sql<number>`count(*)::int`,
    })
    .from(schema.photoTags)
    .innerJoin(schema.tags, eq(schema.photoTags.tagId, schema.tags.id))
    .innerJoin(schema.photos, eq(schema.photoTags.photoId, schema.photos.id))
    .where(and(eq(schema.photos.isPublic, true), eq(schema.photos.status, "ready")))
    .groupBy(schema.tags.id, schema.tags.name, schema.tags.slug)
    .orderBy(sql`count(*) desc`);
}

export default async function TagsPage() {
  const tags = await getTags();

  return (
    <div className="container">
      <div className="page-header" style={{ marginTop: 32 }}>
        <div>
          <h1>Tags</h1>
          <p>Browse photos by tag.</p>
        </div>
      </div>

      {tags.length === 0 ? (
        <div className="empty-state">No tags yet.</div>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          {tags.map((tag) => (
            <Link
              key={tag.id}
              href={`/?tag=${encodeURIComponent(tag.slug)}`}
              className="btn btn-secondary"
            >
              {tag.name}
              <span style={{ color: "var(--muted)" }}>&nbsp;{tag.count}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
