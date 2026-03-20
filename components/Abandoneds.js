'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSelector } from 'react-redux';
import { Eye, Trash2, Search, Filter, Calendar, Phone, Mail, ShoppingCart } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import styles from '../src/app/orders/orders.module.css';

const DEFAULT_PAGINATION = {
  currentPage: 1,
  totalPages: 1,
  totalOrders: 0,
  hasMore: false,
};

const normalizeOrderCalled = (status) => {
  const normalized = String(status || '').toLowerCase();

  if (normalized === 'called') return 'Called';
  if (normalized === 'notpicked') return 'notpicked';

  return 'pending';
};

const modifyCloudinaryUrl = (url) => {
  if (!url) return '';
  if (!url.includes('/upload/')) return url;

  const urlParts = url.split('/upload/');
  return `${urlParts[0]}/upload/c_limit,h_1000,f_auto,q_50/${urlParts[1]}`;
};

const formatCurrency = (amount) => {
  const value = Number(amount) || 0;
  return value.toLocaleString('en-IN');
};

const Abandoned = () => {
  const [abandonedOrders, setAbandonedOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [pagination, setPagination] = useState(DEFAULT_PAGINATION);

  const user = useSelector((state) => state.auth.user);
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentPage = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);

  const updateURL = useCallback((page) => {
    const params = new URLSearchParams();
    if (page > 1) params.set('page', page);

    const query = params.toString();
    router.push(query ? `/abandoned?${query}` : '/abandoned', { scroll: false });
  }, [router]);

  const fetchAbandonedOrders = useCallback(async () => {
    try {
      setLoading(true);

      const response = await fetch(`/api/abandoned/getallabandoneds?page=${currentPage}`, {
        cache: 'no-store',
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch abandoned orders');
      }

      setAbandonedOrders(Array.isArray(data.orders) ? data.orders : []);
      setPagination({
        currentPage: data.currentPage || currentPage,
        totalPages: data.totalPages || 1,
        totalOrders: data.totalOrders || 0,
        hasMore: Boolean(data.hasMore),
      });

      if (data.currentPage && data.currentPage !== currentPage) {
        updateURL(data.currentPage);
      }
    } catch (error) {
      console.error('Error fetching abandoned orders:', error);
      toast.error('Failed to load abandoned orders');
    } finally {
      setLoading(false);
    }
  }, [currentPage, updateURL]);

  useEffect(() => {
    fetchAbandonedOrders();
  }, [fetchAbandonedOrders]);

  const handleDelete = async (order) => {
    if (!window.confirm(`Are you sure you want to delete abandoned order #${order.orderNumber}?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/abandoned/delete-abandoned?id=${order._id}&token=${user?.token}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error('Failed to delete abandoned order');
      }

      await fetch('/api/history/create-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: user?.firstname,
          title: order.orderNumber,
          sku: order.shippingInfo?.firstname,
          productchange: 'Delete the Abandoned',
          time: new Date().toISOString(),
        }),
      });

      toast.success('Abandoned order deleted successfully');
      fetchAbandonedOrders();
    } catch (error) {
      console.error('Error deleting abandoned order:', error);
      toast.error('Failed to delete abandoned order');
    }
  };

  const nextPage = () => {
    if (currentPage < pagination.totalPages) {
      updateURL(currentPage + 1);
    }
  };

  const prevPage = () => {
    if (currentPage > 1) {
      updateURL(currentPage - 1);
    }
  };

  const getStatusColor = (status) => {
    switch (normalizeOrderCalled(status)) {
      case 'Called':
        return '#10b981';
      case 'notpicked':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  };

  const getStatusText = (status) => {
    switch (normalizeOrderCalled(status)) {
      case 'Called':
        return 'Called';
      case 'notpicked':
        return 'Not Picked';
      default:
        return 'Pending';
    }
  };

  const filteredOrders = abandonedOrders
    .filter((order) => {
      if (!searchTerm) return true;

      const searchLower = searchTerm.toLowerCase();
      const phone = String(order.shippingInfo?.phone || '');

      return (
        String(order.orderNumber || '').toLowerCase().includes(searchLower) ||
        String(order.shippingInfo?.firstname || '').toLowerCase().includes(searchLower) ||
        String(order.shippingInfo?.lastname || '').toLowerCase().includes(searchLower) ||
        phone.includes(searchTerm) ||
        String(order.shippingInfo?.email || '').toLowerCase().includes(searchLower)
      );
    })
    .filter((order) => {
      if (statusFilter === 'all') return true;
      return normalizeOrderCalled(order.orderCalled) === statusFilter;
    });

  if (loading && abandonedOrders.length === 0) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner}></div>
        <p>Loading abandoned orders...</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Abandoned Carts</h1>
          <p className={styles.subtitle}>Manage and recover abandoned shopping carts</p>
        </div>
        <div className={styles.headerActions}>
          <span className={styles.pageInfo}>Total: {pagination.totalOrders}</span>
        </div>
      </div>

      <div className={styles.searchContainer}>
        <div className={styles.searchBox}>
          <Search size={18} className={styles.searchIcon} />
          <input
            type="text"
            placeholder="Search by order number, customer name, phone, or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={styles.searchField}
          />
        </div>
        <div className={styles.filterButtons}>
          <Filter size={16} />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={styles.filterSelect}
          >
            <option value="all">All Status</option>
            <option value="Called">Contacted</option>
            <option value="notpicked">Not Picked</option>
            <option value="pending">Pending</option>
          </select>
        </div>
      </div>

      {filteredOrders.length === 0 ? (
        <div className={styles.empty}>
          <ShoppingCart size={48} />
          <h3>No abandoned orders found</h3>
          <p>
            {searchTerm || statusFilter !== 'all'
              ? 'Try adjusting your search or filters'
              : 'No abandoned carts at the moment'}
          </p>
        </div>
      ) : (
        <>
          <div className={styles.grid}>
            {filteredOrders.map((order) => (
              <div key={order._id} className={styles.card}>
                <div className={styles.cardHeader}>
                  <div>
                    <span className={styles.orderNumber}>#{order.orderNumber}</span>
                    <span
                      className={styles.badge}
                      style={{
                        backgroundColor: getStatusColor(order.orderCalled),
                        color: 'white',
                      }}
                    >
                      {getStatusText(order.orderCalled)}
                    </span>
                  </div>
                  <div className={styles.date}>
                    <Calendar size={14} />
                    {new Date(order.createdAt).toLocaleDateString('en-IN')}
                  </div>
                </div>

                <div className={styles.customer}>
                  <h4>{order.shippingInfo?.firstname} {order.shippingInfo?.lastname}</h4>
                  <div className={styles.contact}>
                    <Mail size={12} />
                    <span>{order.shippingInfo?.email || 'N/A'}</span>
                  </div>
                  <div className={styles.contact}>
                    <Phone size={12} />
                    <span>+91 {order.shippingInfo?.phone || 'N/A'}</span>
                  </div>
                </div>

                <div className={styles.preview}>
                  {order.orderItems?.slice(0, 2).map((item, index) => (
                    <div key={index} className={styles.previewItem}>
                      {item?.product?.images?.[0]?.url ? (
                        <img
                          src={modifyCloudinaryUrl(item.product.images[0].url)}
                          alt={item?.product?.title || 'Product image'}
                          className={styles.previewImage}
                        />
                      ) : (
                        <div className={styles.previewImage} />
                      )}
                      <div>
                        <p className={styles.previewTitle}>{item?.product?.title || 'Product removed'}</p>
                        <p className={styles.previewQty}>Qty: {item.quantity} x Rs.{formatCurrency(item.price)}</p>
                      </div>
                    </div>
                  ))}
                  {order.orderItems?.length > 2 && (
                    <span className={styles.more}>+{order.orderItems.length - 2} more items</span>
                  )}
                </div>

                <div className={styles.cardFooter}>
                  <div>
                    <span className={styles.label}>Total</span>
                    <span className={styles.amount}>Rs.{formatCurrency(order.finalAmount)}</span>
                  </div>
                  <div className={styles.actions}>
                    <Link href={`/abandoned/${order._id}`} className={styles.viewBtn}>
                      <Eye size={14} /> View
                    </Link>
                    <button
                      onClick={() => handleDelete(order)}
                      className={styles.cancelBtn}
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className={styles.pagination}>
            <button
              onClick={prevPage}
              disabled={currentPage === 1}
              className={styles.pageBtn}
            >
              Previous
            </button>
            <span className={styles.pageInfo}>Page {currentPage} of {pagination.totalPages}</span>
            <button
              onClick={nextPage}
              disabled={!pagination.hasMore}
              className={styles.pageBtn}
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default Abandoned;
