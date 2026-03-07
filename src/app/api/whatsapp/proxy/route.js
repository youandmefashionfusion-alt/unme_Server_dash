export async function POST(request) {
  try {
    const { url, method, headers, body } = await request.json();

    // Security: only allow requests to the Watuska domain
    if (!url.startsWith('https://watuska-production.up.railway.app/')) {
      return new Response(JSON.stringify({ error: 'Invalid URL' }), { status: 400 });
    }

    const response = await fetch(url, {
      method: method || 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify(body),
    });

    // Handle both JSON and text responses
    const contentType = response.headers.get('content-type');
    let data;
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Proxy error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}