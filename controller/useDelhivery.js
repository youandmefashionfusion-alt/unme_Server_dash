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

const toPositiveString = (value, fallback) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return String(fallback);
  return String(parsed);
};

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

const getDelhiveryMessage = (data, fallback = 'Request failed') => {
  if (!data) return fallback;
  if (typeof data === 'string') return extractMessageText(data) || fallback;

  const pkg = Array.isArray(data?.packages) ? data.packages[0] : null;
  const remarks = pkg?.remarks;

  const candidates = [
    data?.error,
    data?.message,
    data?.rmk,
    data?.detail,
    remarks,
  ];

  const resolved = candidates
    .map(extractMessageText)
    .find((candidate) => candidate.length > 0);

  return resolved || fallback;
};

const prettifyDelhiveryError = (message) => {
  const raw = extractMessageText(message);

  if (/ClientWarehouse matching query does not exist/i.test(raw)) {
    return `Pickup location not found in Delhivery for "${WAREHOUSE.name}". Set DELHIVERY_WAREHOUSE_NAME to the exact pickup location name from your Delhivery panel.`;
  }

  return raw || 'Delhivery request failed. Please verify token, warehouse and shipment details.';
};

const safeJsonParse = (value) => {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

async function delhiveryCall(action, payload) {
  const res = await fetch('/api/delhivery', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, payload }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    return {
      success: false,
      status: res.status,
      error: getDelhiveryMessage(data, `Request failed (${res.status})`),
      raw: data,
    };
  }

  return { success: true, status: res.status, data };
}

export function useDelhivery() {
  const createShipment = async (order) => {
    const {
      shippingInfo,
      finalAmount,
      orderType,
      orderNumber,
      orderItems,
      _dimensions,
    } = order;

    const dimensions = _dimensions || {};

    const shipment = {
      name:
        `${shippingInfo.firstname || ''} ${shippingInfo.lastname || ''}`.trim() ||
        shippingInfo.firstname ||
        'Customer',
      add: shippingInfo.address,
      city: shippingInfo.city,
      state: shippingInfo.state,
      pin: String(shippingInfo.pincode),
      phone: String(shippingInfo.phone),
      order: orderNumber,
      payment_mode: orderType === 'COD' ? 'COD' : 'Prepaid',
      cod_amount: orderType === 'COD' ? String(finalAmount) : '0',
      total_amount: String(finalAmount),
      shipment_width: toPositiveString(dimensions.width, 10),
      shipment_height: toPositiveString(dimensions.height, 5),
      shipment_length: toPositiveString(dimensions.length, 15),
      weight: toPositiveString(dimensions.weight, 200),
      products_desc: (orderItems || [])
        .map((i) => i?.product?.title || i?.product?.name || 'Item')
        .join(', '),
      quantity: String(
        Math.max(
          (orderItems || []).reduce(
            (sum, item) => sum + (Number(item?.quantity) || 0),
            0
          ),
          1
        )
      ),
      return_name: WAREHOUSE.name,
      return_add: WAREHOUSE.address,
      return_city: WAREHOUSE.city,
      return_state: WAREHOUSE.state,
      return_pin: WAREHOUSE.pin,
      return_phone: WAREHOUSE.phone,
    };

    const toastId = toast.loading('Creating shipment on Delhivery...');

    try {
      const result = await delhiveryCall('create_shipment', { shipment });

      if (!result.success) {
        const readableError = prettifyDelhiveryError(result.error);
        toast.error(readableError, { id: toastId });
        return { success: false, error: readableError, raw: result.raw };
      }

      const data = result.data;
      const waybill = data?.packages?.[0]?.waybill || data?.waybill;

      if (waybill) {
        toast.success(`Shipment created! Waybill: ${waybill}`, { id: toastId });
        return { success: true, waybill, raw: data };
      }

      const msg = getDelhiveryMessage(
        data,
        'Shipment creation failed. Please check Delhivery token, warehouse and pincode.'
      );
      const readableError = prettifyDelhiveryError(msg);
      toast.error(readableError, { id: toastId });
      return { success: false, error: readableError, raw: data };
    } catch (err) {
      toast.error('Network error creating shipment', { id: toastId });
      return { success: false, error: err.message };
    }
  };

  const requestPickup = async (waybill, pickupDatetime) => {
    const toastId = toast.loading('Scheduling pickup...');

    try {
      const [datePart, timePart] = pickupDatetime.split('T');
      const formattedTime = timePart.length === 5 ? `${timePart}:00` : timePart;

      const result = await delhiveryCall('request_pickup', {
        pickup_location: WAREHOUSE.name,
        pickup_date: datePart,
        pickup_time: formattedTime,
        expected_package_count: 1,
        waybills: [waybill],
      });

      if (!result.success) {
        toast.error(result.error, { id: toastId });
        return { success: false, error: result.error, raw: result.raw };
      }

      const data = result.data;

      if (data?.id || data?.pickup_id) {
        toast.success('Pickup scheduled successfully!', { id: toastId });
        return { success: true, pickupId: data.id || data.pickup_id, raw: data };
      }

      const msg = getDelhiveryMessage(data, 'Pickup request failed');
      toast.error(msg, { id: toastId });
      return { success: false, error: msg, raw: data };
    } catch (err) {
      toast.error('Network error scheduling pickup', { id: toastId });
      return { success: false, error: err.message };
    }
  };

  const trackShipment = async (waybill) => {
    const toastId = toast.loading('Fetching tracking info...');

    try {
      const result = await delhiveryCall('track', { waybill });

      if (!result.success) {
        toast.error(result.error, { id: toastId });
        return { success: false, error: result.error, raw: result.raw };
      }

      toast.dismiss(toastId);
      return { success: true, data: result.data };
    } catch (err) {
      toast.error('Could not fetch tracking', { id: toastId });
      return { success: false, error: err.message };
    }
  };

  const cancelShipment = async (waybill) => {
    const toastId = toast.loading('Cancelling shipment...');

    try {
      const result = await delhiveryCall('cancel', { waybill });

      if (!result.success) {
        toast.error(result.error, { id: toastId });
        return { success: false, error: result.error, raw: result.raw };
      }

      const data = result.data;

      if (data?.cancellation_status === 'Cancellation Requested' || data?.success === true) {
        toast.success('Cancellation requested successfully', { id: toastId });
        return { success: true, raw: data };
      }

      const msg = getDelhiveryMessage(data, 'Cancel request failed');
      toast.error(msg, { id: toastId });
      return { success: false, error: msg, raw: data };
    } catch (err) {
      toast.error('Network error cancelling shipment', { id: toastId });
      return { success: false, error: err.message };
    }
  };

  const downloadLabel = async (waybill, orderNumber) => {
    const toastId = toast.loading('Downloading waybill label...');

    try {
      const res = await fetch(`/api/delhivery/label?waybill=${waybill}`, {
        method: 'GET',
      });

      if (!res.ok) {
        const rawError = await res.text();
        const parsedError = safeJsonParse(rawError);
        const message = prettifyDelhiveryError(
          getDelhiveryMessage(parsedError || rawError, 'Download failed')
        );
        throw new Error(message);
      }

      const blob = await res.blob();
      const contentType = (res.headers.get('content-type') || blob.type || '').toLowerCase();
      const isPdf = contentType.includes('pdf');
      const isHtml = contentType.includes('text/html');

      if (isPdf && blob.size < 100) {
        const rawBody = await blob.text();
        const parsedBody = safeJsonParse(rawBody);
        const message = prettifyDelhiveryError(
          getDelhiveryMessage(parsedBody || rawBody, 'Invalid PDF response received')
        );
        throw new Error(message);
      }

      if (!isPdf && !isHtml) {
        const rawBody = await blob.text();
        const parsedBody = safeJsonParse(rawBody);
        const message = prettifyDelhiveryError(
          getDelhiveryMessage(parsedBody || rawBody, 'Unsupported label format received')
        );
        throw new Error(message);
      }

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `waybill-${orderNumber || waybill}.${isPdf ? 'pdf' : 'html'}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      toast.success(
        isPdf
          ? 'Waybill downloaded!'
          : 'Waybill downloaded as HTML. Open it and print as PDF if needed.',
        { id: toastId }
      );
      return { success: true, format: isPdf ? 'pdf' : 'html' };
    } catch (err) {
      toast.error(`Could not download waybill: ${err.message}`, { id: toastId });
      return { success: false, error: err.message };
    }
  };

  const checkServiceability = async (pincode) => {
    try {
      const result = await delhiveryCall('check_serviceability', { pincode });

      if (!result.success) {
        return { success: false, error: result.error, raw: result.raw };
      }

      return { success: true, data: result.data };
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
