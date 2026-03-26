import { useState, useMemo, useCallback } from 'react';
import toast from 'react-hot-toast';

export const useOrderForm = (initialOrder = null) => {
  const [formData, setFormData] = useState({
    shippingInfo: {
      firstname: initialOrder?.shippingInfo?.firstname || '',
      lastname: initialOrder?.shippingInfo?.lastname || '',
      email: initialOrder?.shippingInfo?.email || '',
      phone: initialOrder?.shippingInfo?.phone || '',
      address: initialOrder?.shippingInfo?.address || '',
      city: initialOrder?.shippingInfo?.city || '',
      state: initialOrder?.shippingInfo?.state || '',
      pincode: initialOrder?.shippingInfo?.pincode || '',
    },
    orderItems: initialOrder?.orderItems || [],
    orderType: initialOrder?.orderType || 'COD',
    discount: initialOrder?.discount || 0,
    shippingCost: initialOrder?.shippingCost || 0,
    codCharge: initialOrder?.codCharge || 0,
  });

  const [search, setSearch] = useState({ query: '', results: [], show: false });

  const updateShippingInfo = useCallback((field, value) => {
    setFormData(prev => ({
      ...prev,
      shippingInfo: { ...prev.shippingInfo, [field]: value },
    }));
  }, []);

  const updateOrderSetting = useCallback((key, value) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  }, []);

  const addProduct = useCallback((product) => {
    const exists = formData.orderItems.some(item => item.product._id === product._id);
    if (exists) {
      toast.error('Product already added');
      return;
    }

    setFormData(prev => ({
      ...prev,
      orderItems: [...prev.orderItems, {
        product: {
          _id: product._id,
          title: product.title,
          images: product.images,
          price: product.price,
          sku: product.sku,
        },
        quantity: 1,
        price: product.price,
      }],
    }));
    setSearch({ query: '', results: [], show: false });
  }, [formData.orderItems]);

  const updateQuantity = useCallback((index, quantity) => {
    const qty = Math.max(1, parseInt(quantity) || 1);
    setFormData(prev => ({
      ...prev,
      orderItems: prev.orderItems.map((item, i) => 
        i === index ? { ...item, quantity: qty } : item
      ),
    }));
  }, []);

  const removeProduct = useCallback((index) => {
    setFormData(prev => ({
      ...prev,
      orderItems: prev.orderItems.filter((_, i) => i !== index),
    }));
  }, []);

  const totals = useMemo(() => {
    const subtotal = formData.orderItems.reduce(
      (sum, item) => sum + (item.product.price * item.quantity), 0
    );
    const safeDiscount = Math.max(Number(formData.discount || 0), 0);
    const safeShipping = Math.max(Number(formData.shippingCost || 0), 0);
    const appliedCodCharge =
      formData.orderType === 'COD' ? Math.max(Number(formData.codCharge || 0), 0) : 0;
    const total = subtotal - safeDiscount + safeShipping + appliedCodCharge;
    return { subtotal, total };
  }, [formData.orderItems, formData.discount, formData.shippingCost, formData.codCharge, formData.orderType]);

  const validate = useCallback(() => {
    if (!formData.shippingInfo.firstname?.trim()) {
      toast.error('Customer name is required');
      return false;
    }
    if (!formData.shippingInfo.phone?.trim()) {
      toast.error('Phone number is required');
      return false;
    }
    if (formData.orderItems.length === 0) {
      toast.error('Add at least one product');
      return false;
    }
    return true;
  }, [formData]);

  return {
    formData,
    totals,
    search,
    setSearch,
    updateShippingInfo,
    updateOrderSetting,
    addProduct,
    updateQuantity,
    removeProduct,
    validate,
  };
};
