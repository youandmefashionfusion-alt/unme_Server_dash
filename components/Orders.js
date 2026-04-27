'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Plus, Search, Calendar, MapPin, Phone, Package, X, Check, Download, Trash2, Gift, MessageSquare, Save, Upload } from 'lucide-react';
import { useOrders } from '../controller/useOrders';
import styles from '../src/app/orders/orders.module.css';
import filterStyles from '../src/app/orders/orderFilters.module.css';
import toast from 'react-hot-toast';
import { useSelector } from 'react-redux';
import { isRestrictedAdmin } from '@/lib/restrictedAdmin';

// Filter definitions
const FILTERS = [
  { key: 'all', label: 'All', color: 'default' },
  { key: 'confirmed', label: 'Confirmed', color: 'green' },
  { key: 'pending', label: 'Pending', color: 'yellow' },
  { key: 'cancelled', label: 'Cancelled', color: 'red' },
  { key: 'returned', label: 'Returned', color: 'orange' },
  { key: 'cod', label: 'COD', color: 'amber' },
  { key: 'prepaid', label: 'Prepaid', color: 'purple' },
];

const INR_SYMBOL = '\u20B9';
const PREPAID_ORDER_TYPES = new Set(['prepaid', 'payu', 'online', 'pre-paid']);

const normalize = (value) => String(value || '').trim().toLowerCase();
const normalizeOrderType = (value) => String(value || '').trim().toLowerCase();
const normalizeOrderStatus = (value) => String(value || '').trim().toLowerCase();
const normalizePaymentMarker = (value) => String(value || '').trim().toLowerCase();
const formatInrValue = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '0';
  return numeric.toLocaleString('en-IN', {
    minimumFractionDigits: Number.isInteger(numeric) ? 0 : 2,
    maximumFractionDigits: 2,
  });
};
const isCodByPaymentInfo = (order) => {
  const markers = [
    normalizePaymentMarker(order?.paymentInfo?.razorpayOrderId),
    normalizePaymentMarker(order?.paymentInfo?.razorpayPaymentId),
    normalizePaymentMarker(order?.paymentInfo?.paymentId),
  ];
  return markers.includes('cod');
};
const isPrepaidOrder = (order) => {
  if (isCodByPaymentInfo(order)) return false;
  return PREPAID_ORDER_TYPES.has(normalizeOrderType(order?.orderType));
};
const isCancelledOrder = (order) => {
  const orderType = normalizeOrderType(order?.orderType);
  const orderStatus = normalizeOrderStatus(order?.orderStatus);
  return orderType === 'cancelled' || orderStatus === 'cancelled';
};
const getOrderTypeLabel = (order) => {
  if (isCancelledOrder(order)) return 'Cancelled';
  if (isCodByPaymentInfo(order)) return 'COD';
  if (isPrepaidOrder(order)) return 'Prepaid';
  const normalizedType = normalizeOrderType(order?.orderType);
  if (normalizedType === 'cod') return 'COD';
  if (normalizedType === 'returned') return 'Returned';
  return order?.orderType || 'N/A';
};
const getLatestOrderNote = (order) => {
  const comments = Array.isArray(order?.orderComment) ? order.orderComment : [];
  if (!comments.length) return '';
  const latestComment = comments[comments.length - 1];
  return String(latestComment?.message || '').trim();
};

export default function OrdersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const page = parseInt(searchParams.get('page')) || 1;

  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showExportModal, setShowExportModal] = useState(false);
  const [fromOrder, setFromOrder] = useState('');
  const [toOrder, setToOrder] = useState('');
  const [exportLoading, setExportLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [noteDrafts, setNoteDrafts] = useState({});
  const [savingNoteOrderId, setSavingNoteOrderId] = useState('');
  const importInputRef = useRef(null);
  const { orders, loading, pagination, fetchOrders, updateOrderStatus, filters } = useOrders();
  const { user } = useSelector((state) => state.auth);
  const canDeleteOrders = isRestrictedAdmin(user);

  useEffect(() => {
    fetchOrders(page, searchQuery, activeFilter, startDate, endDate);
  }, [page, searchQuery, activeFilter, startDate, endDate, fetchOrders]);

  useEffect(() => {
    const nextDrafts = {};
    orders.forEach((order) => {
      if (!order?._id) return;
      nextDrafts[order._id] = getLatestOrderNote(order);
    });
    setNoteDrafts(nextDrafts);
  }, [orders]);

  const handleSearch = (e) => {
    if (e.key === 'Enter') {
      router.push(`/orders?page=1`);
      fetchOrders(1, searchQuery, activeFilter, startDate, endDate);
    }
  };

  const handleFilterToggle = (key) => {
    // Clicking the active filter again resets to 'all'
    const next = activeFilter === key && key !== 'all' ? 'all' : key;
    setActiveFilter(next);
    router.push('/orders?page=1');
  };
  const handleDateChange = (type, value) => {
    if (type === 'start') setStartDate(value);
    else setEndDate(value);
    // Reset to page 1 when dates change
    router.push('/orders?page=1');
  };


  const handleConfirm = async (order) => {
    if (await updateOrderStatus(order._id, 'confirm')) {
      fetchOrders(page, searchQuery, activeFilter);
    }
    const orderItemsString = order?.orderItems?.map((item) => {
      return `- ${item.product.title} - ${INR_SYMBOL}${item.product.price} x ${item.quantity}`;
    }).join('<br>');
    try {
      const res = await fetch(`/api/order/update-order-tag?id=${order._id}&token=${user?.token}&tag=Confirm`);
      const bodyForWatuska = {
        to: `+91${order?.shippingInfo?.phone}`,
        templateName: 'order_confirmed_client',
        language: 'en_US',
        variables: {
          "1": order?.shippingInfo?.firstname,
          "2": order?.orderNumber,
          "3": orderItemsString,
          "4": order?.finalAmount,
          "5": order?.orderType,
        },
        name: order?.shippingInfo?.firstname,
      };

      await fetch('/api/whatsapp/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: 'https://watuska-production.up.railway.app/api/template/api-send/1422096086324574',
          method: 'POST',
          headers: {
            'Authorization': 'Bearer wsk_live_7d2b7194c3432df51c698cf8e80a7f8073055428b9c65585b8ccfde42960c8aa',
          },
          body: bodyForWatuska,
        }),
      });
      const data = await res.json();
      if (data) toast.success(data.message);
    } catch (err) {
      console.log(err);
    }
  };

  const handleCancel = async (order) => {
    if (!confirm('Cancel this order?')) return;
    if (await updateOrderStatus(order._id, 'cancel')) {
      fetchOrders(page, searchQuery, activeFilter);
    }
    try {
      const res = await fetch(`/api/order/update-order-tag?id=${order._id}&token=${user?.token}&tag=Cancel`);
      const data = await res.json();
      if (data) toast.success(data.message);
    } catch (err) {
      console.log(err);
    }
  };

  const handleDeleteOrder = async (order) => {
    if (!canDeleteOrders) {
      toast.error('You are not authorized to delete orders');
      return;
    }
    if (!confirm(`Delete order #${order?.orderNumber}? This action cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/order/delete-order?id=${order?._id}&token=${user?.token}`, {
        method: 'DELETE',
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data?.success) {
        throw new Error(data?.message || 'Failed to delete order');
      }

      await fetch('/api/order/set-history', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: order?._id,
          name: user?.firstname || 'Admin',
          message: `Order deleted by ${user?.firstname || 'admin'}`,
          time: new Date(),
        }),
      });

      toast.success('Order deleted successfully');
      fetchOrders(page, searchQuery, activeFilter, startDate, endDate);
    } catch (error) {
      toast.error(error.message || 'Unable to delete order');
    }
  };

  const handleSaveOrderNote = async (order) => {
    const orderId = order?._id;
    const note = String(noteDrafts?.[orderId] || '').trim();

    if (!orderId) return;
    if (!note) {
      toast.error('Please enter a note');
      return;
    }

    setSavingNoteOrderId(orderId);
    try {
      const response = await fetch('/api/order/set-msg', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          name: user?.firstname || 'Admin',
          message: note,
          time: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save note');
      }

      await fetch('/api/order/set-history', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          name: user?.firstname || 'Admin',
          message: `Order note updated by ${user?.firstname || 'admin'}`,
          time: new Date().toISOString(),
        }),
      });

      toast.success('Order note saved');
      fetchOrders(page, searchQuery, activeFilter, startDate, endDate);
    } catch (error) {
      toast.error(error?.message || 'Unable to save note');
    } finally {
      setSavingNoteOrderId('');
    }
  };

  const formatDate = (date) =>
    new Date(date).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric',
    });

  const modifyImageUrl = (url) => {
    if (!url) return '/placeholder.jpg';
    const cloudfront = process.env.NEXT_PUBLIC_CLOUDFRONT_URL || process.env.CLOUDFRONT_URL || 'https://d2gtpgxs0y565n.cloudfront.net';
    
    // Check if it's an S3 URL - convert to CloudFront
    if (url.includes('s3.') || url.includes('amazonaws.com')) {
      try {
        const urlObj = new URL(url);
        const pathname = urlObj.pathname;
        return `${cloudfront}${pathname}`;
      } catch (e) {
        return url;
      }
    }
    
    // Apply Cloudinary transformations for Cloudinary URLs
    const parts = url.split('/upload/');
    if (parts.length === 2) {
      return `${parts[0]}/upload/c_limit,h_80,f_auto,q_60/${parts[1]}`;
    }
    
    return url; // Fallback to original URL
  };

  const getStatusClass = (order) => {
    if (isCancelledOrder(order)) return styles.cancelled;
    return isPrepaidOrder(order) ? styles.prepaid : styles.cod;
  };


  // Active filter label for result count display
  const activeFilterLabel = FILTERS.find((f) => f.key === activeFilter)?.label || 'All';

  const openImportPicker = () => {
    if (importLoading) return;
    importInputRef.current?.click();
  };

  const handleImportOrders = async (event) => {
    const file = event?.target?.files?.[0];
    if (!file) return;

    if (!user?.token) {
      toast.error('Authentication required to import orders');
      event.target.value = '';
      return;
    }

    setImportLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`/api/order/import-orders?token=${encodeURIComponent(user.token)}`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || data?.message || 'Failed to import orders');
      }

      const createdCount = Number(data?.createdCount || 0);
      const skippedCount = Number(data?.skippedCount || 0);
      const failedCount = Number(data?.failedCount || 0);

      toast.success(
        `Import complete: ${createdCount} created, ${skippedCount} skipped, ${failedCount} failed`
      );

      fetchOrders(page, searchQuery, activeFilter, startDate, endDate);
    } catch (error) {
      toast.error(error?.message || 'Import failed');
    } finally {
      setImportLoading(false);
      event.target.value = '';
    }
  };

  const handleExport = async () => {
    if (!fromOrder.trim() || !toOrder.trim()) {
      toast.error('Please enter both from and to order numbers');
      return;
    }
    // Optional: basic format check (starts with YM)
    if (!fromOrder.startsWith('YM') || !toOrder.startsWith('YM')) {
      toast.error('Order numbers must start with YM (e.g., YM001)');
      return;
    }
    if (fromOrder > toOrder) {
      toast.error('From order number cannot be greater than to order number');
      return;
    }
    setExportLoading(true);
    try {
      const params = new URLSearchParams({
        fromOrderNumber: fromOrder,
        toOrderNumber: toOrder,
        data: 'youandme'
      });
      const response = await fetch(`/api/user/export-data?${params}`, {
        method: 'POST'
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Export failed');
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      // Get filename from Content-Disposition header
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = 'orders.xlsx';
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^"]+)"?/);
        if (match) filename = match[1];
      }
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success('Export started');
      setShowExportModal(false);
      setFromOrder('');
      setToOrder('');
    } catch (err) {
      toast.error(err.message || 'Failed to export orders');
    } finally {
      setExportLoading(false);
    }
  };
  if (loading && orders.length === 0) {
    return (
      <div className={styles.loading}>
        <lottie-player src="/Loader-cat.json" background="transparent" speed="1" loop autoplay aria-label="Loading" style={{ width: 200, height: 200, display: "inline-block" }} />
        <p>Loading orders...</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Orders</h1>
          <p className={styles.subtitle}>Manage and track customer orders</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className={styles.secondaryBtn} onClick={openImportPicker} disabled={importLoading}>
            <Upload size={18} />
            {importLoading ? 'Importing...' : 'Import Orders'}
          </button>
          <button className={styles.secondaryBtn} onClick={() => setShowExportModal(true)}>
            <Download size={18} />
            Export
          </button>
          <Link href="/orders/create" className={styles.primaryBtn}>
            <Plus size={18} />
            New Order
          </Link>
        </div>
        <input
          ref={importInputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          style={{ display: 'none' }}
          onChange={handleImportOrders}
        />
      </div>

      <div className={styles.searchContainer}>
        <div className={styles.searchBox}>
          <Search size={18} className={styles.searchIcon} />
          <input
            type="text"
            placeholder="Search by order number, customer, email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearch}
            className={styles.searchField}
          />
          {searchQuery && (
            <button
              className={filterStyles.clearSearch}
              onClick={() => {
                setSearchQuery('');
                fetchOrders(1, '', activeFilter, startDate, endDate);
              }}
            >
              <X size={14} />
            </button>
          )}
        </div>
        <div className={styles.dateRange}>
          <input
            type="date"
            value={startDate}
            onChange={(e) => handleDateChange('start', e.target.value)}
            className={styles.dateInput}
          />
          <span>to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => handleDateChange('end', e.target.value)}
            className={styles.dateInput}
          />
        </div>
      </div>

      {/* Filter Toggles */}
      <div className={filterStyles.filterBar}>
        {FILTERS.map((filter) => {
          const stats = filters?.[filter.key] || { count: 0, total: 0 };
          const display = filter.key === 'all'
            ? filter.label
            : `${filter.label} (${stats.count} - ${INR_SYMBOL}${formatInrValue(stats.total)})`;
          return (
            <button
              key={filter.key}
              className={`${filterStyles.filterBtn} ${filterStyles[`color_${filter.color}`]} ${activeFilter === filter.key ? filterStyles.active : ''}`}
              onClick={() => handleFilterToggle(filter.key)}
            >
              {display}
              {activeFilter === filter.key && filter.key !== 'all' && (
                <X size={11} className={filterStyles.filterX} />
              )}
            </button>
          );
        })}
      </div>

      {/* Result summary */}
      {(activeFilter !== 'all' || searchQuery || startDate || endDate) && (
        <p className={filterStyles.resultSummary}>
          Showing <strong>{orders.length}</strong> of <strong>{pagination.totalOrders}</strong> orders
          {activeFilter !== 'all' ? ` (${FILTERS.find(f => f.key === activeFilter)?.label})` : ''}
          {searchQuery ? ` matching "${searchQuery}"` : ''}
          {startDate && endDate ? ` from ${startDate} to ${endDate}` : ''}
        </p>
      )}

      {/* Orders Grid */}
      {orders.length === 0 ? (
        <div className={styles.empty}>
          <Package size={48} />
          <h3>No orders found</h3>
          <p>
            {activeFilter !== 'all'
              ? `No ${activeFilterLabel.toLowerCase()} orders found`
              : 'Create your first order to get started'}
          </p>
          {activeFilter !== 'all' ? (
            <button className={styles.primaryBtn} onClick={() => setActiveFilter('all')}>
              Clear Filter
            </button>
          ) : (
            <Link href="/orders/create" className={styles.primaryBtn}>
              <Plus size={18} /> Create Order
            </Link>
          )}
        </div>
      ) : (
        <>
          <div className={styles.grid}>
            {orders.map((order) => (
              <div key={order._id} className={styles.card}>
                {/* Card Header */}
                <div className={styles.cardHeader}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                    <span className={styles.orderNumber}>#{order.orderNumber}</span>
                    <span className={`${styles.badge} ${getStatusClass(order)}`}>
                      {getOrderTypeLabel(order)}
                    </span>
                    {!isCancelledOrder(order) && order?.orderCalled === 'Called' && (
                      <span className={`${styles.badge} ${styles.prepaid}`}>
                        Confirmed
                      </span>
                    )}
                    <span className={`${styles.badge} ${styles.codBlue}`}>
                      {order?.orderStatus}
                    </span>
                  </div>
                  <div className={styles.date}>
                    <Calendar size={14} />
                    {formatDate(order.createdAt)}
                  </div>
                </div>

                {/* Customer */}
                <div className={styles.customer}>
                  <h4>{order.shippingInfo.firstname} {order.shippingInfo.lastname}</h4>
                  <div className={styles.contact}>
                    <Phone size={12} />
                    <span>{order.shippingInfo.phone}</span>
                  </div>
                  <div className={styles.address}>
                    <MapPin size={12} />
                    <span>{order.shippingInfo.city}, {order.shippingInfo.state}</span>
                  </div>
                </div>

                {/* Product Preview */}
                <div className={styles.preview}>
                  {order.orderItems.slice(0, 1).map((item) => (
                    <div key={item._id} className={styles.previewItem}>
                      <img
                        src={modifyImageUrl(item.product?.images?.[0]?.url)}
                        alt={item.product?.title}
                        className={styles.previewImage}
                      />
                      <div>
                        <p className={styles.previewTitle}>{item.product?.title}</p>
                        <p className={styles.previewQty}>Qty: {item.quantity}</p>
                        {(item?.giftWrap || item?.isGift) && (
                          <div className={styles.previewGiftMeta}>
                            {item?.giftWrap && (
                              <p className={styles.previewGiftBadge}>
                                <Gift size={12} />
                                Gift Wrap
                              </p>
                            )}
                            {item?.isGift && item?.giftMessage && (
                              <div className={styles.previewMessageCard}>
                                <p className={styles.previewMessageHeading}>Custom Message</p>
                                <p className={styles.previewMessageText}>{item.giftMessage}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {order.orderItems.length > 1 && (
                    <span className={styles.more}>+{order.orderItems.length - 1} more</span>
                  )}
                </div>

                <div className={styles.noteSection}>
                  <div className={styles.noteHeader}>
                    <MessageSquare size={14} />
                    <span>Note</span>
                  </div>
                  {getLatestOrderNote(order) && (
                    <p className={styles.notePreview}>
                      Last note: {getLatestOrderNote(order)}
                    </p>
                  )}
                  <div className={styles.noteComposer}>
                    <input
                      type="text"
                      value={noteDrafts?.[order._id] || ''}
                      onChange={(e) =>
                        setNoteDrafts((prev) => ({
                          ...prev,
                          [order._id]: e.target.value,
                        }))
                      }
                      placeholder="Add note for this order..."
                      className={styles.noteInput}
                    />
                    <button
                      onClick={() => handleSaveOrderNote(order)}
                      className={styles.noteSaveBtn}
                      disabled={savingNoteOrderId === order._id}
                      title="Save Note"
                    >
                      <Save size={13} />
                      {savingNoteOrderId === order._id ? 'Saving' : 'Save'}
                    </button>
                  </div>
                </div>

                {/* Footer */}
                <div className={styles.cardFooter}>
                  <div>
                    <span className={styles.label}>Total</span>
                    <span className={styles.amount}>{INR_SYMBOL}{formatInrValue(order.finalAmount)}</span>
                  </div>
                  <div className={styles.actions}>
                    <Link href={`/orders/${order._id}`} className={styles.viewBtn}>
                      View
                    </Link>
                    {order.orderCalled !== 'Called' && (
                      <button
                        onClick={() => handleConfirm(order)}
                        className={styles.confirmBtn}
                        title="Confirm"
                      >
                        <Check size={14} />
                      </button>
                    )}
                    {!isCancelledOrder(order) && (
                      <button
                        onClick={() => handleCancel(order)}
                        className={styles.cancelBtn}
                        title="Cancel"
                      >
                        <X size={14} />
                      </button>
                    )}
                    {canDeleteOrders && (
                      <button
                        onClick={() => handleDeleteOrder(order)}
                        className={styles.cancelBtn}
                        title="Delete Order"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          <div className={styles.pagination}>
            <button
              onClick={() => router.push(`/orders?page=${page - 1}`)}
              disabled={page <= 1}
              className={styles.pageBtn}
            >
              Previous
            </button>
            <span className={styles.pageInfo}>Page {page}</span>
            <button
              onClick={() => router.push(`/orders?page=${page + 1}`)}
              disabled={!pagination.hasMore}
              className={styles.pageBtn}
            >
              Next
            </button>
          </div>
        </>
      )}
      {showExportModal && (
        <div className={styles.modalOverlay} onClick={() => setShowExportModal(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Export Orders</h3>
              <button className={styles.closeBtn} onClick={() => setShowExportModal(false)}>
                <X size={18} />
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.field}>
                <label>From Order Number (e.g., YM001)</label>
                <input
                  type="text"
                  value={fromOrder}
                  onChange={(e) => setFromOrder(e.target.value)}
                  placeholder="YM001"
                />
              </div>
              <div className={styles.field}>
                <label>To Order Number (e.g., YM100)</label>
                <input
                  type="text"
                  value={toOrder}
                  onChange={(e) => setToOrder(e.target.value)}
                  placeholder="YM100"
                />
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.secondaryBtn} onClick={() => setShowExportModal(false)}>
                Cancel
              </button>
              <button className={styles.primaryBtn} onClick={handleExport} disabled={exportLoading}>
                {exportLoading ? 'Exporting...' : 'Export'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
