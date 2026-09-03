import {
  pgTable,
  pgEnum,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  inet,
  uniqueIndex,
  index,
  primaryKey,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const photoStatus = pgEnum("photo_status", [
  "pending",
  "processing",
  "ready",
  "failed",
]);

export const fileType = pgEnum("file_type", ["jpg", "raw"]);

export const adminUsers = pgTable("admin_users", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const photos = pgTable(
  "photos",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    title: text("title"),
    description: text("description"),
    originalFilename: text("original_filename").notNull(),
    rawFormat: text("raw_format").notNull(),
    rawStorageKey: text("raw_storage_key").notNull(),
    rawSha256: text("raw_sha256").notNull(),
    jpgStorageKey: text("jpg_storage_key"),
    thumbStorageKey: text("thumb_storage_key"),
    status: photoStatus("status").notNull().default("pending"),
    errorMessage: text("error_message"),
    exif: jsonb("exif"),
    takenAt: timestamp("taken_at", { withTimezone: true }),
    cameraMake: text("camera_make"),
    cameraModel: text("camera_model"),
    width: integer("width"),
    height: integer("height"),
    uploadedBy: uuid("uploaded_by").references(() => adminUsers.id),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    isPublic: boolean("is_public").notNull().default(true),
  },
  (table) => ({
    rawSha256Idx: uniqueIndex("photos_raw_sha256_idx").on(table.rawSha256),
    statusIdx: index("photos_status_idx").on(table.status),
    takenAtIdx: index("photos_taken_at_idx").on(table.takenAt),
    publicUploadedIdx: index("photos_public_uploaded_idx").on(table.isPublic, table.uploadedAt),
  }),
);

export const albums = pgTable(
  "albums",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    coverPhotoId: uuid("cover_photo_id").references(() => photos.id, { onDelete: "set null" }),
    isPublic: boolean("is_public").notNull().default(true),
    createdBy: uuid("created_by").references(() => adminUsers.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    slugIdx: uniqueIndex("albums_slug_idx").on(table.slug),
    publicIdx: index("albums_public_idx").on(table.isPublic),
  }),
);

export const tags = pgTable(
  "tags",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
  },
  (table) => ({
    slugIdx: uniqueIndex("tags_slug_idx").on(table.slug),
    nameIdx: uniqueIndex("tags_name_idx").on(table.name),
  }),
);

export const photoAlbums = pgTable(
  "photo_albums",
  {
    photoId: uuid("photo_id")
      .notNull()
      .references(() => photos.id, { onDelete: "cascade" }),
    albumId: uuid("album_id")
      .notNull()
      .references(() => albums.id, { onDelete: "cascade" }),
    addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.photoId, table.albumId] }),
    albumIdx: index("photo_albums_album_idx").on(table.albumId),
  }),
);

export const photoTags = pgTable(
  "photo_tags",
  {
    photoId: uuid("photo_id")
      .notNull()
      .references(() => photos.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.photoId, table.tagId] }),
    tagIdx: index("photo_tags_tag_idx").on(table.tagId),
  }),
);

export const downloadEvents = pgTable(
  "download_events",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    photoId: uuid("photo_id")
      .notNull()
      .references(() => photos.id, { onDelete: "cascade" }),
    fileType: fileType("file_type").notNull(),
    token: text("token").unique(),
    ipAddress: inet("ip_address").notNull(),
    userAgent: text("user_agent"),
    downloadedAt: timestamp("downloaded_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    watermarkOk: boolean("watermark_ok"),
    downloadedByAdmin: boolean("downloaded_by_admin").notNull().default(false),
  },
  (table) => ({
    photoIdx: index("download_events_photo_idx").on(table.photoId),
    tokenIdx: index("download_events_token_idx").on(table.token),
    downloadedAtIdx: index("download_events_downloaded_at_idx").on(table.downloadedAt),
  }),
);
