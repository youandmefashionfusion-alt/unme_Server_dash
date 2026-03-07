// app/api/delhivery/label/route.js
import { NextResponse } from 'next/server';

const BASE = process.env.DELHIVERY_BASE_URL;
const TOKEN = process.env.DELHIVERY_API_TOKEN;

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const waybill = searchParams.get('waybill');

  if (!waybill) {
    return NextResponse.json({ error: 'Waybill required' }, { status: 400 });
  }

  try {
    const res = await fetch(
      `${BASE}/api/p/packing_slip?wbns=${waybill}`,
      { headers: { Authorization: `Token ${TOKEN}` } }
    );

    const data = await res.json();
    const slip = data?.packages?.[0];

    if (!slip) {
      return NextResponse.json({ error: 'No slip data returned', raw: data }, { status: 502 });
    }

    // Render as printable HTML
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <title>Waybill ${slip.waybill}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 12px; padding: 16px; }
    .label { border: 2px solid #000; width: 400px; padding: 12px; }
    .header { display: flex; justify-content: space-between; border-bottom: 1px solid #000; padding-bottom: 8px; margin-bottom: 8px; }
    .brand { font-size: 18px; font-weight: bold; }
    .waybill { font-size: 22px; font-weight: bold; text-align: center; margin: 10px 0; letter-spacing: 2px; }
    .barcode { text-align: center; font-family: monospace; font-size: 11px; margin: 6px 0; }
    .section { margin: 8px 0; }
    .section-title { font-weight: bold; font-size: 10px; text-transform: uppercase; color: #666; }
    .section-value { font-size: 13px; margin-top: 2px; }
    .divider { border-top: 1px dashed #000; margin: 8px 0; }
    .badge { display: inline-block; padding: 3px 10px; border: 2px solid #000; font-weight: bold; font-size: 14px; }
    .footer { font-size: 10px; color: #666; margin-top: 8px; text-align: center; }
    @media print { body { padding: 0; } button { display: none; } }
  </style>
</head>
<body>
  <div class="label">
    <div class="header">
      <div class="brand">UnMe Jewels</div>
      <div>
        <span class="badge">${slip.payment_mode || 'COD'}</span>
      </div>
    </div>

    <div class="waybill">${slip.waybill}</div>
    <div class="barcode">||| ${slip.waybill} |||</div>

    <div class="divider"></div>

    <div class="section">
      <div class="section-title">Ship To</div>
      <div class="section-value"><strong>${slip.consignee || ''}</strong></div>
      <div class="section-value">${slip.to_address || ''}</div>
      <div class="section-value">${slip.to_city || ''}, ${slip.to_state || ''} - ${slip.to_pincode || ''}</div>
      <div class="section-value">📞 ${slip.phone || ''}</div>
    </div>

    <div class="divider"></div>

    <div class="section">
      <div class="section-title">From</div>
      <div class="section-value">${slip.shipper_name || 'UnMe Jewels'}</div>
      <div class="section-value">${slip.from_address || 'G-65, Sector 63, Noida'}</div>
    </div>

    <div class="divider"></div>

    <div style="display:flex; justify-content:space-between;">
      <div class="section">
        <div class="section-title">Order No.</div>
        <div class="section-value">${slip.refnum || ''}</div>
      </div>
      <div class="section">
        <div class="section-title">COD Amount</div>
        <div class="section-value"><strong>₹${slip.cod_amount || '0'}</strong></div>
      </div>
      <div class="section">
        <div class="section-title">Weight</div>
        <div class="section-value">${slip.weight || ''}g</div>
      </div>
    </div>

    <div class="divider"></div>

    <div class="section">
      <div class="section-title">Product</div>
      <div class="section-value">${slip.products || ''}</div>
    </div>

    <div class="footer">
      Powered by Delhivery · ${new Date().toLocaleDateString('en-IN')}
    </div>
  </div>

  <br/>
  <button onclick="window.print()" style="padding:8px 20px;font-size:14px;cursor:pointer;">
    🖨️ Print / Save as PDF
  </button>
</body>
</html>`;

    return new NextResponse(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });

  } catch (err) {
    console.error('[Label Error]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}