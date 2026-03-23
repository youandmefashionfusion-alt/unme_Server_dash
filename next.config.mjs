/** @type {import('next').NextConfig} */

const remotePatterns = [
  {
    protocol: "https",
    hostname: "cdn.shopify.com",
  },
];

const s3BaseUrl = process.env.AWS_S3_PUBLIC_BASE_URL;
const cloudfrontUrl = process.env.CLOUDFRONT_URL;
const s3Bucket = process.env.AWS_S3_BUCKET || process.env.AWS_S3_BUCKET_NAME;
const s3Region = process.env.AWS_S3_REGION || process.env.AWS_REGION;

if (s3BaseUrl) {
  try {
    const parsed = new URL(s3BaseUrl);
    remotePatterns.push({
      protocol: parsed.protocol.replace(":", ""),
      hostname: parsed.hostname,
    });
  } catch {
    // Ignore invalid URL and continue.
  }
} else if (cloudfrontUrl) {
  try {
    const parsed = new URL(cloudfrontUrl);
    remotePatterns.push({
      protocol: parsed.protocol.replace(":", ""),
      hostname: parsed.hostname,
    });
  } catch {
    // Ignore invalid URL and continue.
  }
} else if (s3Bucket && s3Region) {
  remotePatterns.push({
    protocol: "https",
    hostname: `${s3Bucket}.s3.${s3Region}.amazonaws.com`,
  });
}

remotePatterns.push({
  protocol: "https",
  hostname: "res.cloudinary.com",
});

remotePatterns.push({
  protocol: "https",
  hostname: "youandme-media.s3.ap-south-1.amazonaws.com",
});

const nextConfig = {
  reactCompiler: true,
  images: {
    remotePatterns,
  },
};

export default nextConfig;
