// app/api/delhivery/route.js
import { NextResponse } from 'next/server';

const BASE = process.env.DELHIVERY_BASE_URL || 'https://track.delhivery.com';
const TOKEN = process.env.DELHIVERY_API_TOKEN;

const jsonHeaders = {
    Authorization: `Token ${TOKEN}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
};

export async function POST(req) {
    const { action, payload } = await req.json();

    try {
        // ─── CREATE SHIPMENT ──────────────────────────────────────────────────────
        if (action === 'create_shipment') {
            const formBody = new URLSearchParams();
            formBody.append('format', 'json');
            formBody.append(
                'data',
                JSON.stringify({
                    shipments: [payload.shipment],
                    pickup_location: { name: process.env.DELHIVERY_WAREHOUSE_NAME },
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

            const data = await res.json();
            return NextResponse.json(data);
        }

        // ─── REQUEST PICKUP ───────────────────────────────────────────────────────
        if (action === 'request_pickup') {
            const res = await fetch(`${BASE}/fm/request/new/`, {
                method: 'POST',
                headers: {
                    Authorization: `Token ${TOKEN}`,
                    'Content-Type': 'application/json',  // ← must be JSON
                },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            return NextResponse.json(data);
        }

        // ─── TRACK SHIPMENT ───────────────────────────────────────────────────────
        if (action === 'track') {
            const res = await fetch(
                `${BASE}/api/v1/packages/json/?waybill=${payload.waybill}&verbose=true`,
                { headers: jsonHeaders }
            );
            const data = await res.json();
            return NextResponse.json(data);
        }

        // ─── CANCEL SHIPMENT ──────────────────────────────────────────────────────
        if (action === 'cancel') {
            const res = await fetch(
                `${BASE}/api/p/edit?waybill=${payload.waybill}&cancellation=true`,
                { method: 'POST', headers: jsonHeaders }
            );
            const data = await res.json();
            return NextResponse.json(data);
        }

        // ─── DOWNLOAD WAYBILL (label PDF) ─────────────────────────────────────────
        if (action === 'download_label') {
            const res = await fetch(
                `${BASE}/api/p/packing_slip?wbns=${payload.waybill}&pdf=true`,
                { headers: { Authorization: `Token ${TOKEN}` } }
            );

            if (!res.ok) {
                return NextResponse.json({ error: 'Label download failed' }, { status: 500 });
            }

            const buffer = await res.arrayBuffer();
            return new NextResponse(buffer, {
                headers: {
                    'Content-Type': 'application/pdf',
                    'Content-Disposition': `attachment; filename="waybill-${payload.waybill}.pdf"`,
                },
            });
        }

        // ─── CHECK SERVICEABILITY ─────────────────────────────────────────────────
        if (action === 'check_serviceability') {
            const res = await fetch(
                `${BASE}/c/api/pin-codes/json/?filter_codes=${payload.pincode}`,
                { headers: jsonHeaders }
            );
            const data = await res.json();
            return NextResponse.json(data);
        }

        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    } catch (err) {
        console.error('[Delhivery API Error]', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}