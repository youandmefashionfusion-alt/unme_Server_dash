// app/api/delhivery/route.js
import { NextResponse } from 'next/server';

const BASE = process.env.DELHIVERY_BASE_URL || 'https://track.delhivery.com';
const TOKEN = process.env.DELHIVERY_API_TOKEN;
const WAREHOUSE_NAME =
  process.env.DELHIVERY_WAREHOUSE_NAME ||
  process.env.NEXT_PUBLIC_DELHIVERY_WAREHOUSE_NAME ||
  'UnMe Jewels';

const getJsonHeaders = () => ({
  Authorization: `Token ${TOKEN}`,
  'Content-Type': 'application/json',
  Accept: 'application/json',
});

const extractMessageText = (value) => {
  if (typeof value === 'string') return value.trim();

  if (Array.isArray(value)) {
    const parts = value
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter((item) => item.length > 0);

    return parts.join(', ');
  }

  return '';
};

const extractErrorMessage = (data, fallback = 'Delhivery request failed') => {
  if (!data) return fallback;
  if (typeof data === 'string') return extractMessageText(data) || fallback;

  const packageInfo = Array.isArray(data?.packages) ? data.packages[0] : null;
  const packageRemarks = packageInfo?.remarks;

  const candidates = [
    data?.error,
    data?.message,
    data?.rmk,
    data?.detail,
    packageRemarks,
  ];

  const resolved = candidates
    .map(extractMessageText)
    .find((candidate) => candidate.length > 0);

  return resolved || fallback;
};

const parseResponseBody = async (res) => {
  const text = await res.text();

  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
};

export async function POST(req) {
  const { action, payload } = await req.json();

  try {
    if (!TOKEN) {
      return NextResponse.json(
        { error: 'DELHIVERY_API_TOKEN is missing in server environment.' },
        { status: 500 }
      );
    }

    if (action === 'create_shipment') {
      const formBody = new URLSearchParams();
      formBody.append('format', 'json');
      formBody.append(
        'data',
        JSON.stringify({
          shipments: [payload.shipment],
          pickup_location: { name: WAREHOUSE_NAME },
        })
      );

      const res = await fetch(`${BASE}/api/cmu/create.json`, {
        method: 'POST',
        headers: {
          Authorization: `Token ${TOKEN}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formBody,
      });

      const data = await parseResponseBody(res);

      if (!res.ok) {
        return NextResponse.json(
          {
            error: extractErrorMessage(data, 'Unable to create Delhivery shipment'),
            raw: data,
          },
          { status: res.status }
        );
      }

      return NextResponse.json(data);
    }

    if (action === 'request_pickup') {
      const res = await fetch(`${BASE}/fm/request/new/`, {
        method: 'POST',
        headers: {
          Authorization: `Token ${TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await parseResponseBody(res);

      if (!res.ok) {
        return NextResponse.json(
          {
            error: extractErrorMessage(data, 'Unable to request pickup'),
            raw: data,
          },
          { status: res.status }
        );
      }

      return NextResponse.json(data);
    }

    if (action === 'track') {
      const res = await fetch(
        `${BASE}/api/v1/packages/json/?waybill=${payload.waybill}&verbose=true`,
        { headers: getJsonHeaders() }
      );

      const data = await parseResponseBody(res);

      if (!res.ok) {
        return NextResponse.json(
          {
            error: extractErrorMessage(data, 'Unable to track shipment'),
            raw: data,
          },
          { status: res.status }
        );
      }

      return NextResponse.json(data);
    }

    if (action === 'cancel') {
      const res = await fetch(
        `${BASE}/api/p/edit?waybill=${payload.waybill}&cancellation=true`,
        { method: 'POST', headers: getJsonHeaders() }
      );

      const data = await parseResponseBody(res);

      if (!res.ok) {
        return NextResponse.json(
          {
            error: extractErrorMessage(data, 'Unable to cancel shipment'),
            raw: data,
          },
          { status: res.status }
        );
      }

      return NextResponse.json(data);
    }

    if (action === 'download_label') {
      const res = await fetch(
        `${BASE}/api/p/packing_slip?wbns=${payload.waybill}&pdf=true`,
        { headers: { Authorization: `Token ${TOKEN}` } }
      );

      if (!res.ok) {
        const data = await parseResponseBody(res);
        return NextResponse.json(
          {
            error: extractErrorMessage(data, 'Label download failed'),
            raw: data,
          },
          { status: res.status }
        );
      }

      const buffer = await res.arrayBuffer();
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="waybill-${payload.waybill}.pdf"`,
        },
      });
    }

    if (action === 'check_serviceability') {
      const res = await fetch(
        `${BASE}/c/api/pin-codes/json/?filter_codes=${payload.pincode}`,
        { headers: getJsonHeaders() }
      );

      const data = await parseResponseBody(res);

      if (!res.ok) {
        return NextResponse.json(
          {
            error: extractErrorMessage(data, 'Unable to check serviceability'),
            raw: data,
          },
          { status: res.status }
        );
      }

      return NextResponse.json(data);
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    console.error('[Delhivery API Error]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
