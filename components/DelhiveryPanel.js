// components/DelhiveryPanel.jsx
'use client';
import { useState, useEffect } from 'react';
import {
  Truck, Package, Calendar, X, Download, RefreshCw,
  CheckCircle, Clock, AlertCircle, MapPin, ChevronDown,
  ChevronUp, Loader
} from 'lucide-react';
import { useDelhivery } from '../controller/useDelhivery';
import toast from 'react-hot-toast';
import styles from './DelhiveryPanel.module.css';

// Status → color/icon map
const STATUS_CONFIG = {
  'In Transit': { color: '#3b82f6', icon: Truck },
  'Delivered':  { color: '#10b981', icon: CheckCircle },
  'Out for Delivery': { color: '#f59e0b', icon: Truck },
  'Pending':    { color: '#6b7280', icon: Clock },
  'Failed Delivery': { color: '#ef4444', icon: AlertCircle },
  'Cancelled':  { color: '#ef4444', icon: X },
  'RTO':        { color: '#f97316', icon: RefreshCw },
  default:      { color: '#6b7280', icon: Package },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.default;
  const Icon = cfg.icon;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      padding: '3px 8px', borderRadius: '999px', fontSize: '12px',
      fontWeight: 600, background: cfg.color + '1a', color: cfg.color,
    }}>
      <Icon size={11} /> {status || 'Unknown'}
    </span>
  );
}

export default function DelhiveryPanel({ order, onTrackingUpdate }) {
  const { createShipment, requestPickup, trackShipment, cancelShipment, downloadLabel } =
    useDelhivery();

  // ── state ──────────────────────────────────────────────────────────────────
  const [waybill, setWaybill] = useState('');
  const [pickupDatetime, setPickupDatetime] = useState('');
  const [trackingData, setTrackingData] = useState(null);
  const [showTracking, setShowTracking] = useState(false);
  const [showDimensions, setShowDimensions] = useState(false);
  const [dimensions, setDimensions] = useState({
    weight: '200', length: '15', width: '10', height: '5',
  });
  const [loading, setLoading] = useState({
    create: false, pickup: false, track: false, cancel: false, download: false,
  });

  const normalizeDatetimeLocal = (value) => {
    if (!value) return '';
    const normalized = String(value).trim();

    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(normalized)) {
      return normalized;
    }

    const parsed = new Date(normalized);
    if (Number.isNaN(parsed.getTime())) return '';

    const tzOffset = parsed.getTimezoneOffset() * 60000;
    return new Date(parsed.getTime() - tzOffset).toISOString().slice(0, 16);
  };

  // Load waybill from order's existing tracking info on mount
  useEffect(() => {
    if (!order?.trackingInfo) return;

    if (order.trackingInfo.partner === 'Delhivery') {
      const fromTrackingId = order.trackingInfo.trackingId;
      const raw = order.trackingInfo.link || '';
      const fromLink = raw.split('TrackingId: ')[1]?.split(',')[0]?.trim();
      const wb = fromTrackingId || fromLink || '';
      if (wb) setWaybill(wb);
    }

    if (order.trackingInfo.pickupDatetime) {
      setPickupDatetime(normalizeDatetimeLocal(order.trackingInfo.pickupDatetime));
    }
  }, [order]);

  const setLoad = (key, val) =>
    setLoading((prev) => ({ ...prev, [key]: val }));

  // ── actions ─────────────────────────────────────────────────────────────────
  const handleCreate = async () => {
    setLoad('create', true);
    try {
      const enrichedOrder = {
        ...order,
        _dimensions: dimensions, // hook will read this
      };
      const result = await createShipment({ ...enrichedOrder, _dimensions: dimensions });
      if (result.success) {
        setWaybill(result.waybill);
        if (onTrackingUpdate) {
          const persisted = await onTrackingUpdate({
            partner: 'Delhivery',
            waybill: result.waybill,
            link: `TrackingId: ${result.waybill}, Tracking Link: https://www.delhivery.com/track/package/${result.waybill}`,
          });
          if (persisted === false) {
            toast.error('Shipment created, but tracking details could not be saved.');
          }
        }
      }
    } finally {
      setLoad('create', false);
    }
  };

  const handlePickup = async () => {
    if (!waybill) return toast.error('No waybill - create shipment first');
    if (!pickupDatetime) return toast.error('Select a pickup date & time');
    setLoad('pickup', true);
    try {
      const result = await requestPickup(waybill, pickupDatetime);
      if (result.success && onTrackingUpdate) {
        const persisted = await onTrackingUpdate({
          partner: 'Delhivery',
          waybill,
          pickupDatetime,
          pickupId: result.pickupId,
          sendEmailUpdate: false,
          updateOrderStatus: false,
        });

        if (persisted === false) {
          toast.error('Pickup created, but pickup details could not be saved.');
        }
      }
    } finally {
      setLoad('pickup', false);
    }
  };

  const handleTrack = async () => {
    if (!waybill) return toast.error('No waybill to track');
    setLoad('track', true);
    const result = await trackShipment(waybill);
    if (result.success) {
      setTrackingData(result.data);
      setShowTracking(true);
    }
    setLoad('track', false);
  };

  const handleCancel = async () => {
    if (!waybill) return toast.error('No waybill to cancel');
    if (!confirm(`Cancel Delhivery shipment ${waybill}?`)) return;
    setLoad('cancel', true);
    await cancelShipment(waybill);
    setLoad('cancel', false);
  };

  const handleDownload = async () => {
    if (!waybill) return toast.error('No waybill to download');
    setLoad('download', true);
    await downloadLabel(waybill, order?.orderNumber);
    setLoad('download', false);
  };

  // ── tracking events ─────────────────────────────────────────────────────────
  const trackingEvents =
    trackingData?.ShipmentData?.[0]?.Shipment?.Scans || [];
  const latestStatus =
    trackingData?.ShipmentData?.[0]?.Shipment?.Status?.Status;

  // ── min datetime (now) ───────────────────────────────────────────────────────
  const minDatetime = new Date(Date.now() + 2 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 16);

  return (
    <div className={styles.panel}>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className={styles.panelHeader}>
        <div className={styles.panelTitle}>
          <Truck size={16} />
          <span>Delhivery</span>
        </div>
        {waybill && <StatusBadge status={latestStatus || 'Shipment Created'} />}
      </div>

      {/* ── Waybill display or Create CTA ─────────────────────────────────── */}
      {waybill ? (
        <div className={styles.waybillBox}>
          <div className={styles.waybillMeta}>
            <span className={styles.waybillLabel}>Waybill</span>
            <span className={styles.waybillNumber}>{waybill}</span>
          </div>
          <a
            href={`https://www.delhivery.com/track/package/${waybill}`}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.trackLink}
          >
            Track on Delhivery →
          </a>
        </div>
      ) : (
        <>
          {/* Optional dimensions toggle */}
          <button
            className={styles.dimToggle}
            onClick={() => setShowDimensions((v) => !v)}
          >
            <Package size={13} />
            Package Dimensions
            {showDimensions ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>

          {showDimensions && (
            <div className={styles.dimGrid}>
              {['weight', 'length', 'width', 'height'].map((key) => (
                <div key={key} className={styles.dimField}>
                  <label>{key === 'weight' ? 'Weight (g)' : `${key.charAt(0).toUpperCase() + key.slice(1)} (cm)`}</label>
                  <input
                    type="number"
                    value={dimensions[key]}
                    onChange={(e) =>
                      setDimensions((prev) => ({ ...prev, [key]: e.target.value }))
                    }
                  />
                </div>
              ))}
            </div>
          )}

          <button
            className={styles.primaryBtn}
            onClick={handleCreate}
            disabled={loading.create}
          >
            {loading.create ? <Loader size={14} className={styles.spin} /> : <Package size={14} />}
            {loading.create ? 'Creating Shipment...' : 'Create Shipment & Get Waybill'}
          </button>
        </>
      )}

      {/* ── Actions (only when waybill exists) ────────────────────────────── */}
      {waybill && (
        <>
          {/* Pickup scheduler */}
          <div className={styles.section}>
            <label className={styles.sectionLabel}>
              <Calendar size={13} /> Schedule Pickup
            </label>
            <div className={styles.pickupRow}>
              <input
                type="datetime-local"
                className={styles.datetimeInput}
                value={pickupDatetime}
                min={minDatetime}
                onChange={(e) => setPickupDatetime(e.target.value)}
              />
              <button
                className={styles.successBtn}
                onClick={handlePickup}
                disabled={loading.pickup || !pickupDatetime}
              >
                {loading.pickup ? <Loader size={13} className={styles.spin} /> : <Truck size={13} />}
                {loading.pickup ? 'Scheduling...' : 'Request Pickup'}
              </button>
            </div>
          </div>

          {/* Action buttons row */}
          <div className={styles.actionRow}>
            <button
              className={styles.outlineBtn}
              onClick={handleTrack}
              disabled={loading.track}
            >
              {loading.track ? <Loader size={13} className={styles.spin} /> : <RefreshCw size={13} />}
              {loading.track ? 'Loading...' : 'Refresh Tracking'}
            </button>

            <button
              className={styles.outlineBtn}
              onClick={handleDownload}
              disabled={loading.download}
            >
              {loading.download ? <Loader size={13} className={styles.spin} /> : <Download size={13} />}
              {loading.download ? 'Downloading...' : 'Download Label'}
            </button>

            <button
              className={styles.dangerOutlineBtn}
              onClick={handleCancel}
              disabled={loading.cancel}
            >
              {loading.cancel ? <Loader size={13} className={styles.spin} /> : <X size={13} />}
              {loading.cancel ? 'Cancelling...' : 'Cancel Shipment'}
            </button>
          </div>
        </>
      )}

      {/* ── Live Tracking Timeline ─────────────────────────────────────────── */}
      {showTracking && trackingData && (
        <div className={styles.trackingPanel}>
          <div className={styles.trackingPanelHeader}>
            <span>Live Tracking</span>
            <button onClick={() => setShowTracking(false)}>
              <X size={14} />
            </button>
          </div>

          {trackingEvents.length > 0 ? (
            <div className={styles.timeline}>
              {trackingEvents.map((event, i) => {
                const scan = event.ScanDetail;
                return (
                  <div key={i} className={`${styles.timelineItem} ${i === 0 ? styles.latest : ''}`}>
                    <div className={styles.timelineDot} />
                    <div className={styles.timelineContent}>
                      <div className={styles.timelineStatus}>{scan?.Scan}</div>
                      <div className={styles.timelineDetail}>{scan?.Instructions}</div>
                      <div className={styles.timelineMeta}>
                        <MapPin size={10} /> {scan?.ScannedLocation}
                        &nbsp;·&nbsp;
                        <Clock size={10} /> {new Date(scan?.ScanDateTime).toLocaleString('en-IN')}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className={styles.emptyTracking}>No scan events yet</p>
          )}
        </div>
      )}
    </div>
  );
}

