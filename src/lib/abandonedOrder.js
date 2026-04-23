export const ABANDONED_GIFT_WRAP_CHARGE = 69;
export const ABANDONED_UPSERT_SKIP_ORDER_CREATION_IDS = new Set([
  "COD",
  "BuyNow",
  "PENDING",
  "PayU",
  "RZP",
]);

const toFiniteNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const hasNumericValue = (value) => {
  if (value === null || value === undefined || value === "") return false;
  return Number.isFinite(Number(value));
};

export const compactObject = (obj = {}) =>
  Object.fromEntries(
    Object.entries(obj).filter(([, value]) => value !== undefined && value !== null && value !== "")
  );

export const toNumberOrFallback = (value, fallback) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const sanitizeGiftMessage = (message) => String(message || "").trim().slice(0, 180);

const getProductId = (product) => {
  if (!product) return "";
  if (typeof product === "string") return product;
  if (typeof product === "object" && product?._id) return String(product._id);
  return "";
};

export const normalizeAbandonedShippingInfo = (shippingInfo = {}) => {
  const rawPhone = String(shippingInfo?.phone ?? "").trim();
  const phoneDigits = rawPhone.replace(/\D/g, "");
  const normalizedPhone = phoneDigits.length === 10 ? Number(phoneDigits) : undefined;

  const rawPincode = String(shippingInfo?.pincode ?? "").trim();
  const pincodeDigits = rawPincode.replace(/\D/g, "");
  const normalizedPincode = pincodeDigits ? Number(pincodeDigits) : undefined;

  return {
    firstname: String(shippingInfo?.firstname || "").trim(),
    lastname: String(shippingInfo?.lastname || "").trim(),
    email: String(shippingInfo?.email || "").trim(),
    phone: normalizedPhone,
    address: String(shippingInfo?.address || "").trim(),
    city: String(shippingInfo?.city || "").trim(),
    state: String(shippingInfo?.state || "").trim(),
    pincode: normalizedPincode,
  };
};

export const normalizeAbandonedOrderItems = (items = []) => {
  if (!Array.isArray(items)) return [];

  return items
    .map((item) => {
      const quantity = Math.max(toFiniteNumber(item?.quantity), 0);
      const price = Math.max(toFiniteNumber(item?.price), 0);
      const isGift = Boolean(item?.isGift);
      const giftWrap = Boolean(item?.giftWrap);
      const productId = getProductId(item?.product);
      const hasPopulatedProduct =
        item?.product && typeof item.product === "object" && item.product?._id;

      return {
        ...item,
        product: hasPopulatedProduct ? item.product : productId,
        quantity,
        price,
        isGift,
        giftWrap,
        giftWrapCharge: giftWrap ? ABANDONED_GIFT_WRAP_CHARGE : 0,
        giftMessage: isGift ? sanitizeGiftMessage(item?.giftMessage) : "",
      };
    })
    .filter((item) => {
      const hasProduct =
        (typeof item.product === "string" && Boolean(item.product)) ||
        (item.product && typeof item.product === "object");
      return hasProduct && item.quantity > 0;
    });
};

export const resolveAbandonedGiftWrapTotal = (order = {}) => {
  if (hasNumericValue(order?.giftWrapTotal)) {
    const storedValue = Math.max(toFiniteNumber(order.giftWrapTotal), 0);
    if (storedValue > 0) return storedValue;
  }

  const items = Array.isArray(order?.orderItems) ? order.orderItems : [];
  return items.some((item) => Boolean(item?.giftWrap)) ? ABANDONED_GIFT_WRAP_CHARGE : 0;
};

export const resolveAbandonedFinalAmount = (order = {}) => {
  if (hasNumericValue(order?.finalAmount)) {
    return Math.max(toFiniteNumber(order.finalAmount), 0);
  }

  const totalPrice = Math.max(toFiniteNumber(order?.totalPrice), 0);
  const shippingCost = Math.max(toFiniteNumber(order?.shippingCost), 0);
  const discount = Math.max(toFiniteNumber(order?.discount), 0);
  const giftWrapTotal = resolveAbandonedGiftWrapTotal(order);

  return totalPrice + shippingCost + giftWrapTotal - discount;
};

export const normalizeAbandonedOrder = (order = {}) => {
  const current = order?.toObject ? order.toObject() : order;
  const normalizedItems = normalizeAbandonedOrderItems(current?.orderItems || []);
  const giftWrapTotal = resolveAbandonedGiftWrapTotal({
    ...current,
    orderItems: normalizedItems,
  });

  return {
    ...current,
    shippingInfo: normalizeAbandonedShippingInfo(current?.shippingInfo || {}),
    orderItems: normalizedItems,
    totalPrice: Math.max(toFiniteNumber(current?.totalPrice), 0),
    shippingCost: Math.max(toFiniteNumber(current?.shippingCost), 0),
    discount: Math.max(toFiniteNumber(current?.discount), 0),
    giftWrapTotal,
    finalAmount: resolveAbandonedFinalAmount({
      ...current,
      orderItems: normalizedItems,
      giftWrapTotal,
    }),
    orderCalled: String(current?.orderCalled || "pending"),
  };
};
