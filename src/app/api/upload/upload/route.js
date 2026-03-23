import { randomUUID } from "crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import s3Client from "../../../../../config/s3";

export const runtime = "nodejs";
export const config = {
  maxDuration: 30,
};

const sanitizeFileName = (name = "file") =>
  String(name)
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "");

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

export async function POST(request) {
  try {
    const bucket = process.env.AWS_S3_BUCKET || process.env.AWS_S3_BUCKET_NAME;
    const region = process.env.AWS_S3_REGION || process.env.AWS_REGION;

    if (!bucket || !region) {
      return Response.json(
        {
          success: false,
          message: "AWS S3 env vars are missing",
        },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const folder = String(formData.get("folder") || "products").replace(/^\/+|\/+$/g, "");

    if (!file || typeof file === "string") {
      return Response.json(
        { success: false, message: "File is required" },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const safeFileName = sanitizeFileName(file.name || "upload");
    const objectKey = `${folder}/${Date.now()}-${randomUUID()}-${safeFileName}`;

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      Body: buffer,
      ContentType: file.type || "application/octet-stream",
    });

    await s3Client.send(command);

    const url = `${getPublicBaseUrl()}/${objectKey}`;

    return Response.json(
      {
        success: true,
        result: {
          public_id: objectKey,
          asset_id: objectKey,
          secure_url: url,
          url,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("S3 upload error:", error);
    return Response.json(
      {
        success: false,
        message: error.message || "Failed to upload file to S3",
      },
      { status: 500 }
    );
  }
}
