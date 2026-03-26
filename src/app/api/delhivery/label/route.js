// app/api/delhivery/label/route.js
import { NextResponse } from 'next/server';
import connectDb from '../../../../../config/connectDb';
import OrderModel from '../../../../../models/orderModel';

const BASE = process.env.DELHIVERY_BASE_URL || 'https://track.delhivery.com';
const TOKEN = process.env.DELHIVERY_API_TOKEN;
const FALLBACK_SHIPPER_NAME =
  process.env.DELHIVERY_WAREHOUSE_NAME ||
  process.env.NEXT_PUBLIC_DELHIVERY_WAREHOUSE_NAME ||
  'UnMe Jewels';
const FALLBACK_SHIPPER_ADDRESS =
  process.env.DELHIVERY_WAREHOUSE_ADDRESS || 'G-65, Sector 63, Noida';

const isPdfBuffer = (buffer) => {
  if (!buffer || buffer.byteLength < 5) return false;
  const bytes =
    buffer instanceof Uint8Array ? buffer.slice(0, 5) : new Uint8Array(buffer.slice(0, 5));
  return (
    bytes[0] === 0x25 && // %
    bytes[1] === 0x50 && // P
    bytes[2] === 0x44 && // D
    bytes[3] === 0x46 && // F
    bytes[4] === 0x2d // -
  );
};

const renderFallbackLabelHtml = (slip) => {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <title>Waybill ${slip?.waybill || ''}</title>
  <style>
    * { margin: 10; padding: 10; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 12px; padding: 16px; background: #fff; }
    .label { border: 2px solid #111; width: 420px; padding: 14px; margin: 0 auto; text-align: center; }
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; border-bottom: 1px solid #ccc; padding-bottom: 8px; }
    .brand { font-size: 20px; font-weight: 700; }
    .badge { border: 1px solid #111; padding: 3px 10px; font-weight: 700; border-radius: 999px; }
    .waybill { font-size: 24px; letter-spacing: 1px; font-weight: 700; text-align: center; margin: 10px 0; }
    .row { margin: 8px 0; }
    .title { font-size: 10px; color: #666; text-transform: uppercase; margin-bottom: 2px; }
    .val { font-size: 13px; color: #111; line-height: 1.35; }
    .divider { border-top: 1px dashed #bbb; margin: 8px 0; }
    .meta { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <div class="label">
    <div class="header">
      <div class="brand">UnMe Jewels</div>
      <div class="badge">${slip?.payment_mode || 'COD'}</div>
    </div>

    <div class="waybill">${slip?.waybill || ''}</div>

    <div class="row">
      <div class="title">Ship To</div>
      <div class="val"><strong>${slip?.consignee || ''}</strong></div>
      <div class="val">${slip?.to_address || ''}</div>
      <div class="val">${slip?.to_city || ''}, ${slip?.to_state || ''} - ${slip?.to_pincode || ''}</div>
      <div class="val">${slip?.phone || ''}</div>
    </div>

    <div class="divider"></div>

    <div class="row">
      <div class="title">From</div>
      <div class="val">${slip?.shipper_name || FALLBACK_SHIPPER_NAME}</div>
      <div class="val">${slip?.from_address || FALLBACK_SHIPPER_ADDRESS}</div>
    </div>

    <div class="divider"></div>

    <div class="meta">
      <div>
        <div class="title">Order No.</div>
        <div class="val">${slip?.refnum || ''}</div>
      </div>
      <div>
        <div class="title">COD Amount</div>
        <div class="val">&#8377;${slip?.cod_amount || '0'}</div>
      </div>
      <div>
        <div class="title">Weight</div>
        <div class="val">${slip?.weight || ''}</div>
      </div>
    </div>
  </div>
</body>
</html>`;
};

const cleanString = (value) => {
  if (value === null || value === undefined) return '';
  if (value === 0) return '0';
  return String(value).trim();
};

const pickFirst = (...values) => {
  for (const value of values) {
    const cleaned = cleanString(value);
    if (cleaned) return cleaned;
  }
  return '';
};

const normalizeDelhiverySlip = (rawSlip, waybill) => {
  const slip = rawSlip || {};
  return {
    waybill: pickFirst(slip?.waybill, slip?.awb, slip?.awb_number, slip?.wbn, waybill),
    payment_mode: pickFirst(slip?.payment_mode, slip?.paymentMode, slip?.mode),
    consignee: pickFirst(slip?.consignee, slip?.name, slip?.customer_name, slip?.to_name),
    to_address: pickFirst(slip?.to_address, slip?.address, slip?.add),
    to_city: pickFirst(slip?.to_city, slip?.city),
    to_state: pickFirst(slip?.to_state, slip?.state),
    to_pincode: pickFirst(slip?.to_pincode, slip?.pin, slip?.pincode),
    phone: pickFirst(slip?.phone, slip?.mobile, slip?.phone_number),
    shipper_name: pickFirst(slip?.shipper_name, slip?.from_name, slip?.return_name, slip?.client),
    from_address: pickFirst(slip?.from_address, slip?.return_add, slip?.warehouse_address),
    refnum: pickFirst(slip?.refnum, slip?.order, slip?.order_id, slip?.reference_number),
    cod_amount: pickFirst(slip?.cod_amount, slip?.collectable_amount, slip?.amount_to_collect),
    weight: pickFirst(slip?.weight, slip?.vol_weight),
  };
};

const escapeRegex = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const getOrderFallbackByWaybill = async (waybill) => {
  if (!waybill) return null;

  await connectDb();
  const escapedWaybill = escapeRegex(waybill);

  const order = await OrderModel.findOne({
    $or: [
      { 'trackingInfo.trackingId': waybill },
      { 'trackingInfo.link': { $regex: escapedWaybill, $options: 'i' } },
    ],
  }).lean();

  if (!order) return null;

  const shipping = order?.shippingInfo || {};
  const firstName = cleanString(shipping?.firstname);
  const lastName = cleanString(shipping?.lastname);
  const fullName = `${firstName} ${lastName}`.trim();

  return {
    waybill,
    payment_mode: order?.orderType === 'COD' ? 'COD' : 'Prepaid',
    consignee: fullName || 'Customer',
    to_address: cleanString(shipping?.address),
    to_city: cleanString(shipping?.city),
    to_state: cleanString(shipping?.state),
    to_pincode: cleanString(shipping?.pincode),
    phone: cleanString(shipping?.phone),
    shipper_name: FALLBACK_SHIPPER_NAME,
    from_address: FALLBACK_SHIPPER_ADDRESS,
    refnum: cleanString(order?.orderNumber),
    cod_amount: order?.orderType === 'COD' ? pickFirst(order?.finalAmount, order?.totalPrice, '0') : '0',
    weight: '',
  };
};

const mergeSlipWithFallback = (delhiverySlip, fallbackSlip, waybill) => {
  return {
    waybill: pickFirst(delhiverySlip?.waybill, fallbackSlip?.waybill, waybill),
    payment_mode: pickFirst(delhiverySlip?.payment_mode, fallbackSlip?.payment_mode, 'COD'),
    consignee: pickFirst(delhiverySlip?.consignee, fallbackSlip?.consignee),
    to_address: pickFirst(delhiverySlip?.to_address, fallbackSlip?.to_address),
    to_city: pickFirst(delhiverySlip?.to_city, fallbackSlip?.to_city),
    to_state: pickFirst(delhiverySlip?.to_state, fallbackSlip?.to_state),
    to_pincode: pickFirst(delhiverySlip?.to_pincode, fallbackSlip?.to_pincode),
    phone: pickFirst(delhiverySlip?.phone, fallbackSlip?.phone),
    shipper_name: pickFirst(delhiverySlip?.shipper_name, fallbackSlip?.shipper_name, FALLBACK_SHIPPER_NAME),
    from_address: pickFirst(delhiverySlip?.from_address, fallbackSlip?.from_address, FALLBACK_SHIPPER_ADDRESS),
    refnum: pickFirst(delhiverySlip?.refnum, fallbackSlip?.refnum),
    cod_amount: pickFirst(delhiverySlip?.cod_amount, fallbackSlip?.cod_amount, '0'),
    weight: pickFirst(delhiverySlip?.weight, fallbackSlip?.weight),
  };
};

const hasMinimumLabelDetails = (slip) => {
  return Boolean(
    pickFirst(slip?.waybill) &&
      (pickFirst(slip?.consignee) || pickFirst(slip?.to_address)) &&
      pickFirst(slip?.refnum)
  );
};

const extractMessageText = (value) => {
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter(Boolean)
      .join(', ');
  }
  return '';
};

const parseErrorMessage = (raw) => {
  if (!raw) return 'Label download failed';

  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return parseErrorMessage(parsed);
    } catch {
      return raw.trim() || 'Label download failed';
    }
  }

  if (typeof raw !== 'object') {
    return 'Label download failed';
  }

  const pkg = Array.isArray(raw?.packages) ? raw.packages[0] : null;
  const message = [raw?.error, raw?.message, raw?.rmk, raw?.detail, pkg?.remarks]
    .map(extractMessageText)
    .find(Boolean);

  return message || 'Label download failed';
};

const tryParseJson = (text) => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const normalizeBase64 = (value) => {
  if (typeof value !== 'string') return '';
  const raw = value.trim();
  if (!raw) return '';
  const commaIndex = raw.indexOf(',');
  return commaIndex >= 0 ? raw.slice(commaIndex + 1).trim() : raw;
};

const decodePdfBase64 = (value) => {
  const base64 = normalizeBase64(value);
  if (!base64) return null;

  try {
    const buffer = Buffer.from(base64, 'base64');
    if (buffer.length > 5 && isPdfBuffer(buffer)) return buffer;
    return null;
  } catch {
    return null;
  }
};

const extractPdfFromPayload = (parsed) => {
  if (!parsed || typeof parsed !== 'object') return null;

  const pkg = Array.isArray(parsed?.packages) ? parsed.packages[0] : null;
  const candidates = [
    parsed?.pdf,
    parsed?.label,
    parsed?.label_pdf,
    parsed?.pdf_content,
    pkg?.pdf,
    pkg?.label,
    pkg?.label_pdf,
    pkg?.pdf_content,
  ];

  for (const candidate of candidates) {
    const decoded = decodePdfBase64(candidate);
    if (decoded) return decoded;
  }

  return null;
};

const extractSlip = (parsed) => {
  if (!parsed || typeof parsed !== 'object') return null;
  if (Array.isArray(parsed?.packages) && parsed.packages[0]) return parsed.packages[0];
  if (parsed?.package && typeof parsed.package === 'object') return parsed.package;
  return null;
};

const parseLabelResponse = async (upstream) => {
  const buffer = await upstream.arrayBuffer();
  const contentType = (upstream.headers.get('content-type') || '').toLowerCase();

  if (upstream.ok && (contentType.includes('pdf') || isPdfBuffer(buffer))) {
    return { ok: true, kind: 'pdf', body: Buffer.from(buffer) };
  }

  const text = new TextDecoder().decode(buffer).trim();
  const parsed = tryParseJson(text);
  const parsedPayload = parsed || text;

  const pdfFromPayload = extractPdfFromPayload(parsed);
  if (pdfFromPayload) {
    return { ok: true, kind: 'pdf', body: pdfFromPayload };
  }

  const slip = extractSlip(parsed);
  if (slip) {
    return { ok: true, kind: 'slip', body: slip };
  }

  return {
    ok: false,
    status: upstream.status,
    error: parseErrorMessage(parsedPayload),
  };
};

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const waybill = searchParams.get('waybill');

  if (!waybill) {
    return NextResponse.json({ error: 'Waybill required' }, { status: 400 });
  }

  if (!TOKEN) {
    return NextResponse.json(
      { error: 'DELHIVERY_API_TOKEN is missing in server environment.' },
      { status: 500 }
    );
  }

  try {
    const endpoints = [
      `${BASE}/api/p/packing_slip?wbns=${encodeURIComponent(waybill)}&pdf=true`,
      `${BASE}/api/p/packing_slip?wbns=${encodeURIComponent(waybill)}`,
    ];

    let lastError = 'Label download failed';
    let lastStatus = 502;
    let fallbackSlipCache;
    let fallbackFetched = false;

    const getFallbackSlip = async () => {
      if (!fallbackFetched) {
        fallbackFetched = true;
        fallbackSlipCache = await getOrderFallbackByWaybill(waybill);
      }
      return fallbackSlipCache;
    };

    for (const endpoint of endpoints) {
      const upstream = await fetch(endpoint, {
        headers: { Authorization: `Token ${TOKEN}` },
      });

      const parsed = await parseLabelResponse(upstream);

      if (parsed.ok && parsed.kind === 'pdf') {
        return new NextResponse(parsed.body, {
          status: 200,
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="waybill-${waybill}.pdf"`,
          },
        });
      }

      if (parsed.ok && parsed.kind === 'slip') {
        const normalizedDelhiverySlip = normalizeDelhiverySlip(parsed.body, waybill);
        const fallbackSlip = await getFallbackSlip();
        const mergedSlip = mergeSlipWithFallback(normalizedDelhiverySlip, fallbackSlip, waybill);

        if (hasMinimumLabelDetails(mergedSlip) || fallbackSlip) {
          const html = renderFallbackLabelHtml(mergedSlip);
          return new NextResponse(html, {
            status: 200,
            headers: {
              'Content-Type': 'text/html; charset=utf-8',
              'Content-Disposition': `attachment; filename="waybill-${waybill}.html"`,
            },
          });
        }

        lastError = 'Label details missing in Delhivery response';
        lastStatus = 502;
        continue;
      }

      lastError = parsed.error || lastError;
      lastStatus = parsed.status || lastStatus;
    }

    const fallbackSlip = await getFallbackSlip();
    if (fallbackSlip && hasMinimumLabelDetails(fallbackSlip)) {
      const html = renderFallbackLabelHtml(fallbackSlip);
      return new NextResponse(html, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Disposition': `attachment; filename="waybill-${waybill}.html"`,
        },
      });
    }

    return NextResponse.json(
      { error: lastError || 'Label download failed' },
      { status: lastStatus >= 400 ? lastStatus : 502 }
    );
  } catch (err) {
    console.error('[Label Error]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
