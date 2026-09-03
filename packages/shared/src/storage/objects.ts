import fs from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as NodeWebReadableStream } from "node:stream/web";
import {
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  type GetObjectCommandOutput,
} from "@aws-sdk/client-s3";
import { r2Bucket, r2Client } from "./r2Client.js";

export async function putObject(
  key: string,
  body: Buffer | Uint8Array,
  contentType: string,
): Promise<void> {
  await r2Client.send(
    new PutObjectCommand({
      Bucket: r2Bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}

export async function putObjectFromPath(
  key: string,
  filePath: string,
  contentType: string,
): Promise<void> {
  const { size } = await fs.promises.stat(filePath);
  await r2Client.send(
    new PutObjectCommand({
      Bucket: r2Bucket,
      Key: key,
      Body: fs.createReadStream(filePath),
      ContentType: contentType,
      ContentLength: size,
    }),
  );
}

export async function getObject(key: string): Promise<GetObjectCommandOutput> {
  return r2Client.send(new GetObjectCommand({ Bucket: r2Bucket, Key: key }));
}

export async function getObjectBuffer(key: string): Promise<Buffer> {
  const result = await getObject(key);
  const bytes = await result.Body!.transformToByteArray();
  return Buffer.from(bytes);
}

export async function getObjectToFile(key: string, destPath: string): Promise<void> {
  const result = await getObject(key);
  const webStream = (await result.Body!.transformToWebStream()) as NodeWebReadableStream<Uint8Array>;
  await pipeline(Readable.fromWeb(webStream), fs.createWriteStream(destPath));
}

export async function deleteObject(key: string): Promise<void> {
  await r2Client.send(new DeleteObjectCommand({ Bucket: r2Bucket, Key: key }));
}
