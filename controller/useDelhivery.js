// controller/useDelhivery.js
import toast from 'react-hot-toast';

const WAREHOUSE = {
    name: process.env.NEXT_PUBLIC_DELHIVERY_WAREHOUSE_NAME || 'UnMe Jewels',
    address: 'G-65, Sector 63, Noida',
    city: 'Noida',
    state: 'Uttar Pradesh',
    pin: '201309',
    phone: '9891565936',
    email: 'unmejewels@gmail.com',
};

async function delhiveryCall(action, payload) {
    const res = await fetch('/api/delhivery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, payload }),
    });
    return res.json();
}

export function useDelhivery() {
    // ─── CREATE SHIPMENT ────────────────────────────────────────────────────────
    const createShipment = async (order) => {
        const { shippingInfo, finalAmount, orderType, orderNumber, orderItems } = order;

        const shipment = {
            name: `${shippingInfo.firstname} ${shippingInfo.lastname}`,
            add: shippingInfo.address,
            city: shippingInfo.city,
            state: shippingInfo.state,
            pin: String(shippingInfo.pincode),
            phone: String(shippingInfo.phone),
            order: orderNumber,
            payment_mode: orderType === 'COD' ? 'COD' : 'Prepaid',
            cod_amount: orderType === 'COD' ? String(finalAmount) : '0',
            total_amount: String(finalAmount),
            shipment_width: '10',
            shipment_height: '5',
            shipment_length: '15',
            weight: '200',
            products_desc: orderItems.map((i) => i.product?.title).join(', '),
            quantity: String(orderItems.reduce((s, i) => s + i.quantity, 0)),
            // Return address
            return_name: WAREHOUSE.name,
            return_add: WAREHOUSE.address,
            return_city: WAREHOUSE.city,
            return_state: WAREHOUSE.state,
            return_pin: WAREHOUSE.pin,
            return_phone: WAREHOUSE.phone,
        };

        const toastId = toast.loading('Creating shipment on Delhivery...');
        try {
            const data = await delhiveryCall('create_shipment', { shipment });

            if (data?.packages?.[0]?.waybill) {
                const waybill = data.packages[0].waybill;
                toast.success(`Shipment created! Waybill: ${waybill}`, { id: toastId });
                return { success: true, waybill, raw: data };
            } else {
                const msg = data?.packages?.[0]?.remarks || data?.rmk || 'Shipment creation failed';
                toast.error(msg, { id: toastId });
                return { success: false, error: msg };
            }
        } catch (err) {
            toast.error('Network error creating shipment', { id: toastId });
            return { success: false, error: err.message };
        }
    };

    // ─── REQUEST PICKUP ─────────────────────────────────────────────────────────
    const requestPickup = async (waybill, pickupDatetime) => {
        const toastId = toast.loading('Scheduling pickup...');
        try {
            const [datePart, timePart] = pickupDatetime.split('T');
            const formattedTime = timePart.length === 5 ? `${timePart}:00` : timePart;

            const data = await delhiveryCall('request_pickup', {
                pickup_location: WAREHOUSE.name,
                pickup_date: datePart,           // "2026-02-24"
                pickup_time: formattedTime,      // "12:01:00"
                expected_package_count: 1,
                waybills: [waybill],
            });

            if (data?.id || data?.pickup_id) {
                toast.success('Pickup scheduled successfully!', { id: toastId });
                return { success: true, pickupId: data.id || data.pickup_id, raw: data };
            } else {
                const msg = data?.error || data?.message || 'Pickup request failed';
                toast.error(msg, { id: toastId });
                return { success: false, error: msg };
            }
        } catch (err) {
            toast.error('Network error scheduling pickup', { id: toastId });
            return { success: false, error: err.message };
        }
    };

    // ─── TRACK SHIPMENT ─────────────────────────────────────────────────────────
    const trackShipment = async (waybill) => {
        const toastId = toast.loading('Fetching tracking info...');
        try {
            const data = await delhiveryCall('track', { waybill });
            toast.dismiss(toastId);
            return { success: true, data };
        } catch (err) {
            toast.error('Could not fetch tracking', { id: toastId });
            return { success: false, error: err.message };
        }
    };

    // ─── CANCEL SHIPMENT ────────────────────────────────────────────────────────
    const cancelShipment = async (waybill) => {
        const toastId = toast.loading('Cancelling shipment...');
        try {
            const data = await delhiveryCall('cancel', { waybill });
            if (
                data?.cancellation_status === 'Cancellation Requested' ||
                data?.success === true
            ) {
                toast.success('Cancellation requested successfully', { id: toastId });
                return { success: true, raw: data };
            } else {
                const msg = data?.error || 'Cancel request failed';
                toast.error(msg, { id: toastId });
                return { success: false, error: msg };
            }
        } catch (err) {
            toast.error('Network error cancelling shipment', { id: toastId });
            return { success: false, error: err.message };
        }
    };

    // ─── DOWNLOAD WAYBILL LABEL ─────────────────────────────────────────────────
    const downloadLabel = async (waybill, orderNumber) => {
        const toastId = toast.loading('Downloading waybill label...');
        try {
            // Direct GET — bypasses the JSON wrapper entirely
            const res = await fetch(`/api/delhivery/label?waybill=${waybill}`, {
                method: 'GET',
            });

            if (!res.ok) throw new Error('Download failed');

            const blob = await res.blob();

            // Verify it's actually a PDF
            if (blob.type !== 'application/pdf' && blob.size < 100) {
                throw new Error('Invalid PDF received');
            }

            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `waybill-${orderNumber || waybill}.pdf`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);

            toast.success('Waybill downloaded!', { id: toastId });
            return { success: true };
        } catch (err) {
            toast.error(`Could not download waybill: ${err.message}`, { id: toastId });
            return { success: false, error: err.message };
        }
    };

    // ─── CHECK SERVICEABILITY ───────────────────────────────────────────────────
    const checkServiceability = async (pincode) => {
        try {
            const data = await delhiveryCall('check_serviceability', { pincode });
            return { success: true, data };
        } catch (err) {
            return { success: false, error: err.message };
        }
    };

    return {
        createShipment,
        requestPickup,
        trackShipment,
        cancelShipment,
        downloadLabel,
        checkServiceability,
    };
}