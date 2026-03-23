import { randomUUID } from "crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import s3Client from "../../../../../config/s3";

export const runtime = "nodejs";
export const config = {
  maxDuration: 30,
};

const sanitize = (value = "") =>
  String(value)
    .trim()
    .replace(/^\/+|\/+$/g, "")
    .replace(/[^a-zA-Z0-9/_-]/g, "-");

const getPublicBaseUrl = () => {
  if (process.env.AWS_S3_PUBLIC_BASE_URL) {
    return process.env.AWS_S3_PUBLIC_BASE_URL.replace(/\/$/, "");
  }
  if (process.env.CLOUDFRONT_URL) {
    return process.env.CLOUDFRONT_URL.replace(/\/$/, "");
  }
  const bucket = process.env.AWS_S3_BUCKET || process.env.AWS_S3_BUCKET_NAME;
  const region = process.env.AWS_S3_REGION || process.env.AWS_REGION;
  return `https://${bucket}.s3.${region}.amazonaws.com`;
};

const normalizeDriveUrl = (url) => {
  if (!url.includes("drive.google.com")) return url;
  const fileId =
    url.match(/\/d\/([^/]+)/)?.[1] ||
    url.match(/[?&]id=([^&]+)/)?.[1];
  if (!fileId) return url;
  return `https://drive.google.com/uc?export=download&id=${fileId}`;
};

const extensionFromType = (contentType) => {
  if (!contentType) return "";
  if (contentType.includes("jpeg")) return "jpg";
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("gif")) return "gif";
  if (contentType.includes("avif")) return "avif";
  if (contentType.includes("mp4")) return "mp4";
  return "";
};

export async function POST(req) {
  try {
    const bucket = process.env.AWS_S3_BUCKET || process.env.AWS_S3_BUCKET_NAME;
    const region = process.env.AWS_S3_REGION || process.env.AWS_REGION;

    if (!bucket || !region) {
      return Response.json(
        { success: false, message: "AWS S3 env vars are missing" },
        { status: 500 }
      );
    }

    const { imageUrl, folder } = await req.json();
    if (!imageUrl) {
      return Response.json(
        { success: false, message: "Image URL is required" },
        { status: 400 }
      );
    }

    const sourceUrl = normalizeDriveUrl(String(imageUrl).trim());
    const sourceResponse = await fetch(sourceUrl, { method: "GET" });
    if (!sourceResponse.ok) {
      return Response.json(
        {
          success: false,
          message: `Unable to fetch source image (${sourceResponse.status})`,
        },
        { status: 400 }
      );
    }

    const contentType =
      sourceResponse.headers.get("content-type") || "application/octet-stream";
    const arrayBuffer = await sourceResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const safeFolder = sanitize(folder || "products");
    const ext = extensionFromType(contentType);
    const objectKey = `${safeFolder}/${Date.now()}-${randomUUID()}${ext ? `.${ext}` : ""}`;

    await s3Client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: objectKey,
        Body: buffer,
        ContentType: contentType,
      })
    );

    const url = `${getPublicBaseUrl()}/${objectKey}`;
    return Response.json(
      {
        success: true,
        result: {
          public_id: objectKey,
          secure_url: url,
          asset_id: objectKey,
          url,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("S3 upload-url error:", error);
    return Response.json(
      {
        success: false,
        message: error.message || "Failed to upload image URL to S3",
      },
      { status: 500 }
    );
  }
}
