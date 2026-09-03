DO $$ BEGIN
 CREATE TYPE "public"."file_type" AS ENUM('jpg', 'raw');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."photo_status" AS ENUM('pending', 'processing', 'ready', 'failed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "admin_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "download_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"photo_id" uuid NOT NULL,
	"file_type" "file_type" NOT NULL,
	"token" text,
	"ip_address" "inet" NOT NULL,
	"user_agent" text,
	"downloaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"watermark_ok" boolean,
	"downloaded_by_admin" boolean DEFAULT false NOT NULL,
	CONSTRAINT "download_events_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text,
	"description" text,
	"original_filename" text NOT NULL,
	"raw_format" text NOT NULL,
	"raw_storage_key" text NOT NULL,
	"raw_sha256" text NOT NULL,
	"jpg_storage_key" text,
	"thumb_storage_key" text,
	"status" "photo_status" DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"exif" jsonb,
	"taken_at" timestamp with time zone,
	"camera_make" text,
	"camera_model" text,
	"width" integer,
	"height" integer,
	"uploaded_by" uuid,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"is_public" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "download_events" ADD CONSTRAINT "download_events_photo_id_photos_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."photos"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "photos" ADD CONSTRAINT "photos_uploaded_by_admin_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "download_events_photo_idx" ON "download_events" USING btree ("photo_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "download_events_token_idx" ON "download_events" USING btree ("token");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "download_events_downloaded_at_idx" ON "download_events" USING btree ("downloaded_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "photos_raw_sha256_idx" ON "photos" USING btree ("raw_sha256");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "photos_status_idx" ON "photos" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "photos_taken_at_idx" ON "photos" USING btree ("taken_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "photos_public_uploaded_idx" ON "photos" USING btree ("is_public","uploaded_at");