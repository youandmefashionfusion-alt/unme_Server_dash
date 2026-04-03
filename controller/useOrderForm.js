import { useState, useMemo, useCallback } from "react";
import toast from "react-hot-toast";
import {
  CHECKOUT_STANDARD_COD_CHARGE,
  CHECKOUT_STANDARD_GIFT_WRAP_CHARGE,
} from "../src/lib/orderPricing";

const toFiniteNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const sanitizeGiftMessage = (message) => String(message || "").trim().slice(0, 180);

const getProductId = (product) => {
  if (!product) return "";
  if (typeof product === "string") return product;
  if (typeof product === "object" && product?._id) return String(product._id);
  return "";
};

const normalizeOrderItems = (items = []) => {
  if (!Array.isArray(items)) return [];

  return items
    .map((item) => {
      const productSource = item?.product || {};
      const quantity = Math.max(toFiniteNumber(item?.quantity, 1), 1);
      const isGift = Boolean(item?.isGift);
      const giftWrap = Boolean(item?.giftWrap);
      const giftWrapCharge = giftWrap
        ? Math.max(
            toFiniteNumber(item?.giftWrapCharge) || CHECKOUT_STANDARD_GIFT_WRAP_CHARGE,
            0
          )
        : 0;

      const productId = getProductId(productSource);
      const productPrice = Math.max(
        toFiniteNumber(item?.price),
        toFiniteNumber(productSource?.price)
      );

      return {
        ...item,
        product: {
          _id: productId,
          title: productSource?.title || item?.title || "Product",
          images: Array.isArray(productSource?.images) ? productSource.images : [],
          price: productPrice,
          sku: productSource?.sku || item?.sku || "",
        },
        quantity,
        price: productPrice,
        isGift,
        giftWrap,
        giftWrapCharge,
        giftMessage: isGift ? sanitizeGiftMessage(item?.giftMessage) : "",
      };
    })
    .filter((item) => Boolean(item?.product?._id));
};

const getInitialFormData = (initialOrder = null) => {
  const normalizedOrderType = initialOrder?.orderType || "COD";
  const normalizedItems = normalizeOrderItems(initialOrder?.orderItems || []);

  return {
    shippingInfo: {
      firstname: initialOrder?.shippingInfo?.firstname || "",
      lastname: initialOrder?.shippingInfo?.lastname || "",
      email: initialOrder?.shippingInfo?.email || "",
      phone: initialOrder?.shippingInfo?.phone || "",
      address: initialOrder?.shippingInfo?.address || "",
      city: initialOrder?.shippingInfo?.city || "",
      state: initialOrder?.shippingInfo?.state || "",
      pincode: initialOrder?.shippingInfo?.pincode || "",
    },
    orderItems: normalizedItems,
    orderType: normalizedOrderType,
    discount: Math.max(toFiniteNumber(initialOrder?.discount), 0),
    shippingCost: Math.max(toFiniteNumber(initialOrder?.shippingCost), 0),
    codCharge:
      normalizedOrderType === "COD"
        ? Math.max(
            toFiniteNumber(initialOrder?.codCharge) || CHECKOUT_STANDARD_COD_CHARGE,
            0
          )
        : 0,
  };
};

export const useOrderForm = (initialOrder = null) => {
  const [formData, setFormData] = useState(getInitialFormData(initialOrder));
  const [search, setSearch] = useState({ query: "", results: [], show: false });

  const updateShippingInfo = useCallback((field, value) => {
    setFormData((prev) => ({
      ...prev,
      shippingInfo: { ...prev.shippingInfo, [field]: value },
    }));
  }, []);

  const replaceFromOrder = useCallback((order) => {
    setFormData(getInitialFormData(order));
  }, []);

  const updateOrderSetting = useCallback((key, value) => {
    setFormData((prev) => {
      if (key === "orderType") {
        const nextOrderType = value;
        if (nextOrderType === "COD") {
          return {
            ...prev,
            orderType: nextOrderType,
            codCharge:
              Math.max(toFiniteNumber(prev.codCharge), 0) ||
              CHECKOUT_STANDARD_COD_CHARGE,
          };
        }
        return { ...prev, orderType: nextOrderType, codCharge: 0 };
      }

      return { ...prev, [key]: value };
    });
  }, []);

  const addProduct = useCallback((product) => {
    setFormData((prev) => {
      const exists = prev.orderItems.some(
        (item) => item?.product?._id === String(product?._id)
      );
      if (exists) {
        toast.error("Product already added");
        return prev;
      }

      return {
        ...prev,
        orderItems: [
          ...prev.orderItems,
          {
            product: {
              _id: String(product?._id || ""),
              title: product?.title || "Product",
              images: Array.isArray(product?.images) ? product.images : [],
              price: Math.max(toFiniteNumber(product?.price), 0),
              sku: product?.sku || "",
            },
            quantity: 1,
            price: Math.max(toFiniteNumber(product?.price), 0),
            isGift: false,
            giftWrap: false,
            giftWrapCharge: 0,
            giftMessage: "",
          },
        ],
      };
    });

    setSearch({ query: "", results: [], show: false });
  }, []);

  const updateQuantity = useCallback((index, quantity) => {
    const qty = Math.max(1, parseInt(quantity, 10) || 1);
    setFormData((prev) => ({
      ...prev,
      orderItems: prev.orderItems.map((item, i) =>
        i === index ? { ...item, quantity: qty } : item
      ),
    }));
  }, []);

  const updateOrderItem = useCallback((index, changes) => {
    setFormData((prev) => ({
      ...prev,
      orderItems: prev.orderItems.map((item, i) => {
        if (i !== index) return item;

        const nextItem = { ...item, ...changes };
        if (Object.prototype.hasOwnProperty.call(changes, "isGift")) {
          nextItem.isGift = Boolean(changes.isGift);
          if (!nextItem.isGift) {
            nextItem.giftMessage = "";
          } else {
            nextItem.giftMessage = sanitizeGiftMessage(nextItem.giftMessage);
          }
        }

        if (Object.prototype.hasOwnProperty.call(changes, "giftWrap")) {
          nextItem.giftWrap = Boolean(changes.giftWrap);
          nextItem.giftWrapCharge = nextItem.giftWrap
            ? Math.max(
                toFiniteNumber(nextItem.giftWrapCharge) ||
                  CHECKOUT_STANDARD_GIFT_WRAP_CHARGE,
                0
              )
            : 0;
        }

        if (Object.prototype.hasOwnProperty.call(changes, "giftWrapCharge")) {
          nextItem.giftWrapCharge = nextItem.giftWrap
            ? Math.max(toFiniteNumber(changes.giftWrapCharge), 0)
            : 0;
        }

        if (Object.prototype.hasOwnProperty.call(changes, "giftMessage")) {
          nextItem.giftMessage = nextItem.isGift
            ? sanitizeGiftMessage(changes.giftMessage)
            : "";
        }

        return nextItem;
      }),
    }));
  }, []);

  const removeProduct = useCallback((index) => {
    setFormData((prev) => ({
      ...prev,
      orderItems: prev.orderItems.filter((_, i) => i !== index),
    }));
  }, []);

  const totals = useMemo(() => {
    const subtotal = formData.orderItems.reduce(
      (sum, item) => sum + toFiniteNumber(item?.product?.price) * toFiniteNumber(item?.quantity),
      0
    );

    const hasGiftWrap = formData.orderItems.some((item) => Boolean(item?.giftWrap));
    const giftWrapTotal = hasGiftWrap ? CHECKOUT_STANDARD_GIFT_WRAP_CHARGE : 0;

    const safeDiscount = Math.max(toFiniteNumber(formData.discount), 0);
    const safeShipping = Math.max(toFiniteNumber(formData.shippingCost), 0);
    const appliedCodCharge =
      formData.orderType === "COD"
        ? Math.max(toFiniteNumber(formData.codCharge), 0)
        : 0;
    const total =
      subtotal + giftWrapTotal - safeDiscount + safeShipping + appliedCodCharge;

    return { subtotal, giftWrapTotal, total };
  }, [
    formData.orderItems,
    formData.discount,
    formData.shippingCost,
    formData.codCharge,
    formData.orderType,
  ]);

  const validate = useCallback(() => {
    if (!String(formData.shippingInfo.firstname || "").trim()) {
      toast.error("Customer name is required");
      return false;
    }
    if (!String(formData.shippingInfo.phone || "").trim()) {
      toast.error("Phone number is required");
      return false;
    }
    if (formData.orderItems.length === 0) {
      toast.error("Add at least one product");
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
    replaceFromOrder,
    addProduct,
    updateQuantity,
    updateOrderItem,
    removeProduct,
    validate,
  };
};
