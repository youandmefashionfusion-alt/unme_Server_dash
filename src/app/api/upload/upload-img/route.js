import { v2 as cloudinary } from "cloudinary";
 
cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});
 
export async function POST(request) {
  try {
    const body = await request.json();
    const { paramsToSign } = body || {};

    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!apiSecret) {
      return Response.json(
        { success: false, message: "Cloudinary API secret is not configured" },
        { status: 500 }
      );
    }

    if (!paramsToSign || typeof paramsToSign !== "object") {
      return Response.json(
        { success: false, message: "paramsToSign is required" },
        { status: 400 }
      );
    }

    const signature = cloudinary.utils.api_sign_request(paramsToSign, apiSecret);

    return Response.json({ success: true, signature });
  } catch (error) {
    return Response.json(
      { success: false, message: "Failed to generate signature" },
      { status: 500 }
    );
  }
}
