import { NextRequest } from "next/server";
import { servePhotoAsset } from "@/lib/servePhotoAsset";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  return servePhotoAsset(req, params.id, { jpg: "thumbStorageKey", avif: "avifThumbStorageKey" });
}
