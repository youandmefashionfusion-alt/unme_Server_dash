import { useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import toast from 'react-hot-toast';

export const useOrders = () => {
  const [orders, setOrders] = useState([]);
  const [filters, setFilters] = useState({});
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, hasMore: false });
  const { user } = useSelector((state) => state.auth);

  // Inside useOrders.js or similar
  const fetchOrders = useCallback(async (page, search, filter, startDate, endDate) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page,
        limit: 50,
        ...(search && { search }),
        ...(filter && filter !== 'all' && { filter }),
        ...(startDate && { startDate }),
        ...(endDate && { endDate }),
      });
      const res = await fetch(`/api/user/getallorders?${params}`);
      const data = await res.json();
      if (data.orders) {
        setOrders(data.orders);
        setPagination({
          currentPage: data.currentPage,
          totalPages: data.totalPages,
          totalOrders: data.totalOrders,
          hasMore: data.currentPage < data.totalPages,
        });
        setFilters(data.filters); // store filter stats
      }
    } catch (error) {
      console.error(error);
      toast.error('Failed to fetch orders');
    } finally {
      setLoading(false);
    }
  }, []);

  const updateOrderStatus = useCallback(async (orderId, action, additionalData = {}) => {
    if (!user?.token) {
      toast.error('Authentication required');
      return false;
    }

    try {
      const endpoints = {
        confirm: `/api/order/confirm-order?id=${orderId}&token=${user.token}`,
        cancel: `/api/order/cancel-order?id=${orderId}&token=${user.token}`,
        retrieve: `/api/order/retrieve-order?id=${orderId}&token=${user.token}`,
        prepaid: `/api/order/prepaid-order?id=${orderId}&token=${user.token}`,
        cod: `/api/order/cod-order?id=${orderId}&token=${user.token}`,
        return: `/api/order/return-order?id=${orderId}&token=${user.token}`,
        delivery: `/api/order/send-delivery?id=${orderId}&token=${user.token}`,
        tracking: `/api/order/send-tracking?id=${orderId}&token=${user.token}`,
      };

      const res = await fetch(endpoints[action], {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: Object.keys(additionalData).length
          ? JSON.stringify(additionalData)
          : undefined,
      });

      if (res.ok) {
        await createHistory(orderId, `${action} by ${user?.firstname}`);
        toast.success(getSuccessMessage(action));
        return true;
      }
    } catch (error) {
      toast.error(`Failed to ${action} order`);
    }
    return false;
  }, [user]);

  const createHistory = async (orderId, message) => {
    try {
      await fetch('/api/order/set-history', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, name: user?.firstname, time: new Date(), message }),
      });
    } catch (error) {
      console.error('History creation failed:', error);
    }
  };

  const getSuccessMessage = (action) => ({
    confirm: 'Order confirmed',
    cancel: 'Order cancelled',
    retrieve: 'Order retrieved',
    prepaid: 'Marked as prepaid',
    delivery: 'Marked as delivered',
    cod: 'Marked as COD',
    return: 'Marked as returned',
    tracking: 'Tracking updated',
  }[action] || 'Order updated');

  return { orders, loading, pagination, fetchOrders, updateOrderStatus, filters };
};
