'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Plus, Search, Calendar, MapPin, Phone, Package, X, Download } from 'lucide-react';
import { useOrders } from '../controller/useOrders';
import styles from '../src/app/orders/orders.module.css';
import filterStyles from '../src/app/orders/orderFilters.module.css';
import toast from 'react-hot-toast';
import { useSelector } from 'react-redux';

// ── Filter definitions ────────────────────────────────────────────────────────
const FILTERS = [
  { key: 'all', label: 'All', color: 'default' },
  { key: 'confirmed', label: 'Confirmed', color: 'green' },
  { key: 'pending', label: 'Pending', color: 'yellow' },
  { key: 'fulfilled', label: 'Fulfilled', color: 'blue' },
  { key: 'cancelled', label: 'Cancelled', color: 'red' },
  { key: 'returned', label: 'Returned', color: 'orange' },
  { key: 'cod', label: 'COD', color: 'amber' },
  { key: 'prepaid', label: 'Prepaid', color: 'purple' },
  { key: 'arriving', label: 'Arriving Today', color: 'teal' },
];

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
  const { orders, loading, pagination, fetchOrders, updateOrderStatus, filters } = useOrders();
  const { user } = useSelector((state) => state.auth);

  useEffect(() => {
    fetchOrders(page, searchQuery, activeFilter, startDate, endDate);
  }, [page, searchQuery, activeFilter, startDate, endDate, fetchOrders]);

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
      return `• ${item.product.title} - ₹${item.product.price} x ${item.quantity}`;
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

  const formatDate = (date) =>
    new Date(date).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric',
    });

  const modifyImageUrl = (url) => {
    if (!url) return '/placeholder.jpg';
    const parts = url.split('/upload/');
    return `${parts[0]}/upload/c_limit,h_80,f_auto,q_60/${parts[1]}`;
  };

  const getStatusClass = (order) => {
    if (order.orderType === 'Cancelled') return styles.cancelled;
    return order.orderType === 'Prepaid' ? styles.prepaid : styles.cod;
  };


  // Active filter label for result count display
  const activeFilterLabel = FILTERS.find((f) => f.key === activeFilter)?.label || 'All';
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
        <div className={styles.spinner}></div>
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
          <button className={styles.secondaryBtn} onClick={() => setShowExportModal(true)}>
            <Download size={18} />
            Export
          </button>
          <Link href="/orders/create" className={styles.primaryBtn}>
            <Plus size={18} />
            New Order
          </Link>
        </div>
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

      {/* ── Filter Toggles ── */}
      <div className={filterStyles.filterBar}>
        {FILTERS.map((filter) => {
          const stats = filters?.[filter.key] || { count: 0, total: 0 };
          const display = filter.key === 'all'
            ? filter.label
            : `${filter.label} (${stats.count} - ₹${stats.total})`;
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
                      {order?.orderType}
                    </span>
                    {order?.orderType !== 'Cancelled' && order?.orderCalled === 'Called' && (
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
                      </div>
                    </div>
                  ))}
                  {order.orderItems.length > 1 && (
                    <span className={styles.more}>+{order.orderItems.length - 1} more</span>
                  )}
                </div>

                {/* Footer */}
                <div className={styles.cardFooter}>
                  <div>
                    <span className={styles.label}>Total</span>
                    <span className={styles.amount}>₹{order.finalAmount}</span>
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
                        ✓
                      </button>
                    )}
                    {order.orderType !== 'Cancelled' && (
                      <button
                        onClick={() => handleCancel(order)}
                        className={styles.cancelBtn}
                        title="Cancel"
                      >
                        ✕
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