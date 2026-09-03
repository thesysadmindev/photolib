import { NextRequest } from "next/server";
import { servePhotoAsset } from "@/lib/servePhotoAsset";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  return servePhotoAsset(params.id, "jpgStorageKey");
}
