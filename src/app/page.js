"use client"
import React, { useState, useEffect, useMemo } from 'react'
import styles from './page.module.css'
import { 
  TrendingUp, 
  ShoppingBag, 
  DollarSign, 
  Calendar,
  Package,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Users,
  ChevronRight,
  RefreshCw
} from 'lucide-react';
import { useSelector } from 'react-redux';

const Home = () => {
  // State management
  const [period, setPeriod] = useState('month');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [stats, setStats] = useState({
    today: { revenue: 0, orders: 0, items: 0 },
    yesterday: { revenue: 0, orders: 0, items: 0 },
    week: { revenue: 0, orders: 0, items: 0 },
    month: { revenue: 0, orders: 0, items: 0 },
    year: { revenue: 0, orders: 0, items: 0 },
    custom: { revenue: 0, orders: 0, items: 0 }
  });
  
  const [recentOrders, setRecentOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [customLoading, setCustomLoading] = useState(false);

  // Fetch dashboard data
  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        const [ordersRes, statsRes] = await Promise.all([
          fetch('/api/user/getallorders?limit=10',{cache:'no-store'}),
          fetch('/api/order/getordersdata',{cache:'no-store'})
        ]);

        const ordersData = await ordersRes.json();
        const statsData = await statsRes.json();

        if (ordersRes.ok) {
          setRecentOrders(ordersData.orders || []);
        }

        if (statsRes.ok) {
          setStats({
            today: {
              revenue: statsData.todaydata?.[0]?.totalIncome || 0,
              orders: statsData.todaydata?.[0]?.totalCount || 0,
              items: statsData.todaydata?.[0]?.items?.flat().length || 0
            },
            yesterday: {
              revenue: statsData.yesterdaydata?.[0]?.totalIncome || 0,
              orders: statsData.yesterdaydata?.[0]?.totalCount || 0,
              items: statsData.yesterdaydata?.[0]?.items?.flat().length || 0
            },
            week: {
              revenue: statsData.weekdata?.[0]?.totalIncome || 0,
              orders: statsData.weekdata?.[0]?.totalCount || 0,
              items: statsData.weekdata?.[0]?.items?.flat().length || 0
            },
            month: {
              revenue: statsData.monthdata?.reduce((sum, m) => sum + (m.amount || 0), 0) || 0,
              orders: statsData.monthdata?.reduce((sum, m) => sum + (m.count || 0), 0) || 0,
              items: statsData.monthdata?.reduce((sum, m) => sum + (m.items?.flat().length || 0), 0) || 0
            },
            year: {
              revenue: statsData.yeardata?.[0]?.amount || 0,
              orders: statsData.yeardata?.[0]?.count || 0,
              items: statsData.yeardata?.[0]?.items?.flat().length || 0
            },
            custom: stats.custom || { revenue: 0, orders: 0, items: 0 }
          });
        }
      } catch (error) {
        console.error('Dashboard data fetch failed:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  // Fetch custom date range data
  const fetchCustomData = async () => {
    if (!dateRange.start || !dateRange.end) return;
    
    setCustomLoading(true);
    try {
      const res = await fetch(
        `/api/order/getordersdata/getcustomdata?startDate=${dateRange.start}&endDate=${dateRange.end}`
      );
      const data = await res.json();
      
      if (res.ok && data[0]) {
        setStats(prev => ({
          ...prev,
          custom: {
            revenue: data[0].totalIncome || 0,
            orders: data[0].totalCount || 0,
            items: data[0].items?.flat().length || 0
          }
        }));
        setPeriod('custom');
      }
    } catch (error) {
      console.error('Custom data fetch failed:', error);
    } finally {
      setCustomLoading(false);
    }
  };

  // Get current period data
  const currentData = useMemo(() => {
    const periodMap = {
      today: stats.today,
      yesterday: stats.yesterday,
      week: stats.week,
      month: stats.month,
      year: stats.year,
      custom: stats.custom
    };
    return periodMap[period] || stats.month;
  }, [period, stats]);

  // Calculate growth
  const growth = useMemo(() => {
    const current = stats.today.revenue;
    const previous = stats.yesterday.revenue;
    if (!previous) return 0;
    return ((current - previous) / previous * 100).toFixed(1);
  }, [stats.today.revenue, stats.yesterday.revenue]);

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  // Format date
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  // Sort orders by date (newest first)
  const sortedOrders = useMemo(() => {
    return [...recentOrders]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 10);
  }, [recentOrders]);
  const {user} = useSelector((state)=>state?.auth)

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner}></div>
        <p>Loading your dashboard...</p>
      </div>
    );
  }

  return (
    <div className={styles.dashboard}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.pageTitle}>Dashboard</h1>
          <p className={styles.pageSubtitle}>
            {formatDate(new Date())} · Welcome back, {user?.firstname}
          </p>
        </div>
        <button className={styles.refreshBtn} onClick={() => window.location.reload()}>
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {/* KPI Cards */}
      <div className={styles.kpiGrid}>
        {/* Today's Revenue */}
        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <div className={styles.kpiIcon} style={{ background: '#FEF3E9', color: '#B45309' }}>
              <DollarSign size={20} />
            </div>
            <div className={`${styles.trend} ${growth >= 0 ? styles.trendUp : styles.trendDown}`}>
              {growth >= 0 ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
              {Math.abs(growth)}%
            </div>
          </div>
          <div className={styles.kpiContent}>
            <span className={styles.kpiLabel}>Today's Revenue</span>
            <h2 className={styles.kpiValue}>{formatCurrency(stats.today.revenue)}</h2>
            <div className={styles.kpiMeta}>
              <span>{stats.today.orders} orders</span>
              <span>•</span>
              <span>{stats.today.items} items</span>
            </div>
          </div>
        </div>

        {/* Period Performance */}
        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <div className={styles.kpiIcon} style={{ background: '#E6F7F0', color: '#047857' }}>
              <TrendingUp size={20} />
            </div>
            <select 
              className={styles.periodSelect}
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
            >
              <option value="yesterday">Yesterday</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="year">This Year</option>
            </select>
          </div>
          <div className={styles.kpiContent}>
            <span className={styles.kpiLabel}>
              {period === 'yesterday' && 'Yesterday'}
              {period === 'week' && 'This Week'}
              {period === 'month' && 'This Month'}
              {period === 'year' && 'This Year'}
              {period === 'custom' && 'Custom Range'}
            </span>
            <h2 className={styles.kpiValue}>{formatCurrency(currentData.revenue)}</h2>
            <div className={styles.kpiMeta}>
              <span>{currentData.orders} orders</span>
              <span>•</span>
              <span>{currentData.items} items</span>
            </div>
          </div>
        </div>

        {/* Custom Range */}
        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <div className={styles.kpiIcon} style={{ background: '#EDE9FE', color: '#6D28D9' }}>
              <Calendar size={20} />
            </div>
          </div>
          <div className={styles.kpiContent}>
            <span className={styles.kpiLabel}>Custom Range</span>
            <h2 className={styles.kpiValue}>{formatCurrency(stats.custom.revenue)}</h2>
            <div className={styles.kpiMeta}>
              <span>{stats.custom.orders} orders</span>
              <span>•</span>
              <span>{stats.custom.items} items</span>
            </div>
          </div>
          <div className={styles.dateRange}>
            <div className={styles.dateInputs}>
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                className={styles.dateField}
                placeholder="Start date"
              />
              <span className={styles.dateSeparator}>–</span>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                className={styles.dateField}
                placeholder="End date"
              />
            </div>
            <button 
              onClick={fetchCustomData}
              className={styles.applyBtn}
              disabled={customLoading || !dateRange.start || !dateRange.end}
            >
              {customLoading ? 'Loading...' : 'Apply'}
            </button>
          </div>
        </div>
      </div>

      {/* Recent Orders */}
      <div className={styles.ordersCard}>
        <div className={styles.ordersHeader}>
          <div>
            <h3 className={styles.ordersTitle}>Recent Orders</h3>
          </div>
          <button className={styles.viewAllBtn}>
            View All
            <ChevronRight size={16} />
          </button>
        </div>

        <div className={styles.tableContainer}>
          <table className={styles.ordersTable}>
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Customer</th>
                <th>Payment</th>
                <th>Items</th>
                <th>Amount</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {sortedOrders.map((order, index) => (
                <tr key={order._id || index} className={styles.tableRow}>
                  <td>
                    <span className={styles.orderNumber}>
                      #{order.orderNumber || 'N/A'}
                    </span>
                  </td>
                  <td>
                    <div className={styles.customer}>
                      <div className={styles.customerAvatar}>
                        {order.shippingInfo?.firstname?.charAt(0) || 'U'}
                      </div>
                      <div>
                        <div className={styles.customerName}>
                          {order.shippingInfo?.firstname} {order.shippingInfo?.lastname}
                        </div>
                        <div className={styles.customerEmail}>
                          {order.shippingInfo?.email || '—'}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={`${styles.paymentBadge} ${
                      order.orderType === 'COD' ? styles.paymentCod : styles.paymentPrepaid
                    }`}>
                      {order.orderType || 'COD'}
                    </span>
                  </td>
                  <td>
                    <div className={styles.itemCount}>
                      <Package size={14} />
                      <span>{order.orderItems?.length || 0}</span>
                    </div>
                  </td>
                  <td>
                    <span className={styles.orderAmount}>
                      {formatCurrency(order.finalAmount || 0)}
                    </span>
                  </td>
                  <td>
                    <div className={styles.orderDate}>
                      <Clock size={14} />
                      <span>{formatDate(order.createdAt)}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {sortedOrders.length === 0 && (
            <div className={styles.emptyState}>
              <ShoppingBag size={32} />
              <p>No orders found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Home;