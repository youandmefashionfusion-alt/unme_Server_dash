export const dynamic = 'force-dynamic';

const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB safety cap

const isValidHttpUrl = (value) => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const imageUrl = searchParams.get('url');

  if (!imageUrl || !isValidHttpUrl(imageUrl)) {
    return new Response('Invalid image URL', { status: 400 });
  }

  try {
    const upstream = await fetch(imageUrl, { cache: 'no-store' });

    if (!upstream.ok) {
      return new Response('Failed to fetch image', { status: upstream.status });
    }

    const contentType = upstream.headers.get('content-type') || 'image/jpeg';
    const contentLength = Number(upstream.headers.get('content-length') || 0);

    if (contentLength > MAX_IMAGE_SIZE_BYTES) {
      return new Response('Image too large', { status: 413 });
    }

    const arrayBuffer = await upstream.arrayBuffer();

    if (arrayBuffer.byteLength > MAX_IMAGE_SIZE_BYTES) {
      return new Response('Image too large', { status: 413 });
    }

    return new Response(arrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    return new Response('Unable to proxy image', { status: 500 });
  }
}

