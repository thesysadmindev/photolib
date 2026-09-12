ALTER TYPE "file_type" ADD VALUE 'avif';--> statement-breakpoint
ALTER TABLE "photos" ADD COLUMN "avif_storage_key" text;--> statement-breakpoint
ALTER TABLE "photos" ADD COLUMN "avif_thumb_storage_key" text;