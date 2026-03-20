"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./page.module.css";
import {
  TrendingUp,
  ShoppingBag,
  DollarSign,
  Calendar,
  Package,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { useSelector } from "react-redux";

const EMPTY_METRIC = { revenue: 0, orders: 0, items: 0 };

const initialStats = {
  today: EMPTY_METRIC,
  yesterday: EMPTY_METRIC,
  week: EMPTY_METRIC,
  month: EMPTY_METRIC,
  year: EMPTY_METRIC,
  custom: EMPTY_METRIC,
};

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const countItems = (items) => {
  if (!Array.isArray(items)) {
    return 0;
  }

  return items.reduce((total, group) => {
    if (Array.isArray(group)) {
      return total + group.length;
    }
    return total;
  }, 0);
};

const metricFromBucket = (bucket) => ({
  revenue: toNumber(bucket?.totalIncome ?? bucket?.amount ?? 0),
  orders: toNumber(bucket?.totalCount ?? bucket?.count ?? 0),
  items: countItems(bucket?.items),
});

const Home = () => {
  const [period, setPeriod] = useState("month");
  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [stats, setStats] = useState(initialStats);
  const [recentOrders, setRecentOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [customLoading, setCustomLoading] = useState(false);
  const [error, setError] = useState("");

  const { user } = useSelector((state) => state?.auth ?? {});

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [ordersRes, statsRes] = await Promise.all([
        fetch("/api/user/getallorders?limit=10", { cache: "no-store" }),
        fetch("/api/order/getordersdata", { cache: "no-store" }),
      ]);

      const [ordersData, statsData] = await Promise.all([
        ordersRes.json(),
        statsRes.json(),
      ]);

      if (!ordersRes.ok) {
        throw new Error(ordersData?.message || "Unable to load recent orders");
      }

      if (!statsRes.ok) {
        throw new Error(statsData?.message || "Unable to load dashboard stats");
      }

      setRecentOrders(Array.isArray(ordersData?.orders) ? ordersData.orders : []);

      setStats((prev) => ({
        today: metricFromBucket(statsData?.todaydata?.[0]),
        yesterday: metricFromBucket(statsData?.yesterdaydata?.[0]),
        week: metricFromBucket(statsData?.weekdata?.[0]),
        month: {
          revenue: Array.isArray(statsData?.monthdata)
            ? statsData.monthdata.reduce((sum, month) => sum + toNumber(month?.amount), 0)
            : 0,
          orders: Array.isArray(statsData?.monthdata)
            ? statsData.monthdata.reduce((sum, month) => sum + toNumber(month?.count), 0)
            : 0,
          items: Array.isArray(statsData?.monthdata)
            ? statsData.monthdata.reduce((sum, month) => sum + countItems(month?.items), 0)
            : 0,
        },
        year: metricFromBucket(statsData?.yeardata?.[0]),
        custom: prev.custom,
      }));
    } catch (fetchError) {
      console.error("Dashboard data fetch failed:", fetchError);
      setError(fetchError?.message || "Unable to load dashboard data");
      setRecentOrders([]);
      setStats(initialStats);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchDashboardData();
  }, [fetchDashboardData]);

  const fetchCustomData = async () => {
    if (!dateRange.start || !dateRange.end) {
      return;
    }

    setCustomLoading(true);
    setError("");

    try {
      const res = await fetch(
        `/api/order/getordersdata/getcustomdata?startDate=${dateRange.start}&endDate=${dateRange.end}`,
        { cache: "no-store" }
      );
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.message || "Unable to load custom range data");
      }

      const customBucket = Array.isArray(data) ? data[0] : null;
      setStats((prev) => ({
        ...prev,
        custom: metricFromBucket(customBucket),
      }));
      setPeriod("custom");
    } catch (fetchError) {
      console.error("Custom data fetch failed:", fetchError);
      setError(fetchError?.message || "Unable to load custom range data");
    } finally {
      setCustomLoading(false);
    }
  };

  const currentData = useMemo(() => {
    const periodMap = {
      today: stats.today,
      yesterday: stats.yesterday,
      week: stats.week,
      month: stats.month,
      year: stats.year,
      custom: stats.custom,
    };

    return periodMap[period] || stats.month;
  }, [period, stats]);

  const growth = useMemo(() => {
    const current = toNumber(stats.today.revenue);
    const previous = toNumber(stats.yesterday.revenue);

    if (previous <= 0) {
      return 0;
    }

    return Number((((current - previous) / previous) * 100).toFixed(1));
  }, [stats.today.revenue, stats.yesterday.revenue]);

  const formatCurrency = useCallback((amount) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(toNumber(amount));
  }, []);

  const formatDate = useCallback((dateInput) => {
    const parsed = new Date(dateInput);

    if (Number.isNaN(parsed.getTime())) {
      return "--";
    }

    return parsed.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }, []);

  const sortedOrders = useMemo(() => {
    return [...recentOrders]
      .sort((a, b) => new Date(b?.createdAt || 0) - new Date(a?.createdAt || 0))
      .slice(0, 10);
  }, [recentOrders]);

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
      <div className={styles.header}>
        <div>
          <h1 className={styles.pageTitle}>Dashboard</h1>
          <p className={styles.pageSubtitle}>
            {formatDate(new Date())} | Welcome back, {user?.firstname || "Admin"}
          </p>
        </div>
        <button className={styles.refreshBtn} onClick={fetchDashboardData}>
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {error && (
        <div className={styles.emptyState}>
          <p>{error}</p>
        </div>
      )}

      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <div className={styles.kpiIcon} style={{ background: "#FEF3E9", color: "#B45309" }}>
              <DollarSign size={20} />
            </div>
            <div className={`${styles.trend} ${growth >= 0 ? styles.trendUp : styles.trendDown}`}>
              {growth >= 0 ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
              {Math.abs(growth)}%
            </div>
          </div>
          <div className={styles.kpiContent}>
            <span className={styles.kpiLabel}>Today&apos;s Revenue</span>
            <h2 className={styles.kpiValue}>{formatCurrency(stats.today.revenue)}</h2>
            <div className={styles.kpiMeta}>
              <span>{stats.today.orders} orders</span>
              <span>|</span>
              <span>{stats.today.items} items</span>
            </div>
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <div className={styles.kpiIcon} style={{ background: "#E6F7F0", color: "#047857" }}>
              <TrendingUp size={20} />
            </div>
            <select className={styles.periodSelect} value={period} onChange={(e) => setPeriod(e.target.value)}>
              <option value="yesterday">Yesterday</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="year">This Year</option>
            </select>
          </div>
          <div className={styles.kpiContent}>
            <span className={styles.kpiLabel}>
              {period === "yesterday" && "Yesterday"}
              {period === "week" && "This Week"}
              {period === "month" && "This Month"}
              {period === "year" && "This Year"}
              {period === "custom" && "Custom Range"}
            </span>
            <h2 className={styles.kpiValue}>{formatCurrency(currentData.revenue)}</h2>
            <div className={styles.kpiMeta}>
              <span>{currentData.orders} orders</span>
              <span>|</span>
              <span>{currentData.items} items</span>
            </div>
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <div className={styles.kpiIcon} style={{ background: "#EDE9FE", color: "#6D28D9" }}>
              <Calendar size={20} />
            </div>
          </div>
          <div className={styles.kpiContent}>
            <span className={styles.kpiLabel}>Custom Range</span>
            <h2 className={styles.kpiValue}>{formatCurrency(stats.custom.revenue)}</h2>
            <div className={styles.kpiMeta}>
              <span>{stats.custom.orders} orders</span>
              <span>|</span>
              <span>{stats.custom.items} items</span>
            </div>
          </div>
          <div className={styles.dateRange}>
            <div className={styles.dateInputs}>
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange((prev) => ({ ...prev, start: e.target.value }))}
                className={styles.dateField}
                placeholder="Start date"
              />
              <span className={styles.dateSeparator}>to</span>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange((prev) => ({ ...prev, end: e.target.value }))}
                className={styles.dateField}
                placeholder="End date"
              />
            </div>
            <button
              onClick={fetchCustomData}
              className={styles.applyBtn}
              disabled={customLoading || !dateRange.start || !dateRange.end}
            >
              {customLoading ? "Loading..." : "Apply"}
            </button>
          </div>
        </div>
      </div>

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
                <tr key={order?._id || index} className={styles.tableRow}>
                  <td>
                    <span className={styles.orderNumber}>#{order?.orderNumber || "N/A"}</span>
                  </td>
                  <td>
                    <div className={styles.customer}>
                      <div className={styles.customerAvatar}>{order?.shippingInfo?.firstname?.charAt(0) || "U"}</div>
                      <div>
                        <div className={styles.customerName}>
                          {order?.shippingInfo?.firstname || "Unknown"} {order?.shippingInfo?.lastname || "Customer"}
                        </div>
                        <div className={styles.customerEmail}>{order?.shippingInfo?.email || "--"}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span
                      className={`${styles.paymentBadge} ${
                        order?.orderType === "COD" ? styles.paymentCod : styles.paymentPrepaid
                      }`}
                    >
                      {order?.orderType || "COD"}
                    </span>
                  </td>
                  <td>
                    <div className={styles.itemCount}>
                      <Package size={14} />
                      <span>{order?.orderItems?.length || 0}</span>
                    </div>
                  </td>
                  <td>
                    <span className={styles.orderAmount}>{formatCurrency(order?.finalAmount || 0)}</span>
                  </td>
                  <td>
                    <div className={styles.orderDate}>
                      <Clock size={14} />
                      <span>{formatDate(order?.createdAt)}</span>
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
