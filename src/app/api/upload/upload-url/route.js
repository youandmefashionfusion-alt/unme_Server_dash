// app/api/upload/upload-url/route.js
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function POST(req) {
  try {
    // Debug: Check if environment variables are loaded
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    console.log('Cloudinary Config Check:', {
      hasCloudName: !!cloudName,
      hasApiKey: !!apiKey,
      hasApiSecret: !!apiSecret,
    });

    if (!cloudName || !apiKey || !apiSecret) {
      return Response.json(
        {
          success: false,
          message: 'Cloudinary credentials not configured properly',
          missing: {
            cloudName: !cloudName,
            apiKey: !apiKey,
            apiSecret: !apiSecret,
          },
        },
        { status: 500 }
      );
    }

    const { imageUrl } = await req.json();

    if (!imageUrl) {
      return Response.json(
        { success: false, message: 'Image URL is required' },
        { status: 400 }
      );
    }

    console.log('Attempting to upload:', imageUrl);

    // Upload the image from URL to Cloudinary
    const result = await cloudinary.uploader.upload(imageUrl, {
      folder: 'products',
      resource_type: 'auto',
      timeout: 60000, // 60 seconds timeout
      api_key: apiKey,
      api_secret: apiSecret,
      cloud_name: cloudName,
    });

    console.log('Upload successful:', result.public_id);

    return Response.json(
      {
        success: true,
        result: {
          public_id: result.public_id,
          secure_url: result.secure_url,
          asset_id: result.asset_id,
          url: result.url,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    return Response.json(
      {
        success: false,
        message: error.message || 'Failed to upload image',
        error: error.toString(),
      },
      { status: 500 }
    );
  }
}