export const CHECKOUT_FREE_SHIPPING_THRESHOLD = 999;
export const CHECKOUT_STANDARD_SHIPPING_CHARGE = 99;
export const CHECKOUT_STANDARD_COD_CHARGE = 99;
export const CHECKOUT_STANDARD_GIFT_WRAP_CHARGE = 69;
const PREPAID_ORDER_TYPES = new Set(["PREPAID", "PAYU", "ONLINE", "PRE-PAID"]);

const toFiniteNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const hasNumericValue = (value) => {
  if (value === null || value === undefined || value === '') {
    return false;
  }
  return Number.isFinite(Number(value));
};

export const resolveOrderShippingCost = (order = {}) => {
  const currentOrder = order && typeof order === 'object' ? order : {};

  if (hasNumericValue(currentOrder.shippingCost)) {
    return Math.max(toFiniteNumber(currentOrder.shippingCost), 0);
  }

  const subtotal = Math.max(toFiniteNumber(currentOrder.totalPrice), 0);
  const finalAmount = resolveOrderFinalAmount(currentOrder);
  const discount = Math.max(toFiniteNumber(currentOrder.discount), 0);
  const normalizedOrderType = String(currentOrder.orderType || '').toUpperCase();

  const codChargeForDerivation =
    normalizedOrderType === 'COD'
      ? hasNumericValue(currentOrder.codCharge)
        ? Math.max(toFiniteNumber(currentOrder.codCharge), 0)
        : CHECKOUT_STANDARD_COD_CHARGE
      : 0;
  const giftWrapTotal = resolveOrderGiftWrapTotal(currentOrder);

  const derivedShipping =
    finalAmount + discount - subtotal - codChargeForDerivation - giftWrapTotal;
  if (Number.isFinite(derivedShipping) && derivedShipping >= 0) {
    return Math.round(derivedShipping);
  }

  return subtotal > CHECKOUT_FREE_SHIPPING_THRESHOLD
    ? 0
    : CHECKOUT_STANDARD_SHIPPING_CHARGE;
};

export const resolveOrderCodCharge = (order = {}, resolvedShippingCost) => {
  const currentOrder = order && typeof order === 'object' ? order : {};
  const normalizedOrderType = String(currentOrder.orderType || '').toUpperCase();
  if (normalizedOrderType !== 'COD') {
    return 0;
  }

  const subtotal = Math.max(toFiniteNumber(currentOrder.totalPrice), 0);
  const finalAmount = resolveOrderFinalAmount(currentOrder);
  const discount = Math.max(toFiniteNumber(currentOrder.discount), 0);
  const shippingCost = Number.isFinite(Number(resolvedShippingCost))
    ? Math.max(toFiniteNumber(resolvedShippingCost), 0)
    : resolveOrderShippingCost(currentOrder);
  const giftWrapTotal = resolveOrderGiftWrapTotal(currentOrder);
  const storedCodCharge = hasNumericValue(currentOrder.codCharge)
    ? Math.max(toFiniteNumber(currentOrder.codCharge), 0)
    : null;

  const derivedCodCharge =
    finalAmount + discount - subtotal - shippingCost - giftWrapTotal;
  if (Number.isFinite(derivedCodCharge) && derivedCodCharge > 0) {
    return Math.round(derivedCodCharge);
  }

  if (storedCodCharge !== null) {
    return storedCodCharge;
  }

  if (Number.isFinite(derivedCodCharge) && derivedCodCharge >= 0) {
    return Math.round(derivedCodCharge);
  }

  return CHECKOUT_STANDARD_COD_CHARGE;
};

export const resolveOrderGiftWrapTotal = (order = {}) => {
  const currentOrder = order && typeof order === 'object' ? order : {};

  if (hasNumericValue(currentOrder.giftWrapTotal)) {
    const storedGiftWrapTotal = Math.max(toFiniteNumber(currentOrder.giftWrapTotal), 0);
    if (storedGiftWrapTotal > 0) {
      return storedGiftWrapTotal;
    }
  }

  const orderItems = Array.isArray(currentOrder.orderItems) ? currentOrder.orderItems : [];
  const hasGiftWrap = orderItems.some((item) => Boolean(item?.giftWrap));
  return hasGiftWrap ? CHECKOUT_STANDARD_GIFT_WRAP_CHARGE : 0;
};

export const resolveOrderFinalAmount = (order = {}) => {
  const currentOrder = order && typeof order === 'object' ? order : {};
  const normalizedOrderType = String(currentOrder.orderType || '').toUpperCase();

  const prepaidAmountPaise = hasNumericValue(currentOrder?.paymentInfo?.razorpayAmountPaise)
    ? Math.max(toFiniteNumber(currentOrder.paymentInfo.razorpayAmountPaise), 0)
    : 0;

  if (PREPAID_ORDER_TYPES.has(normalizedOrderType) && prepaidAmountPaise > 0) {
    return Number((prepaidAmountPaise / 100).toFixed(2));
  }

  return Math.max(toFiniteNumber(currentOrder.finalAmount), 0);
};

export const normalizeOrderPricing = (order = {}) => {
  const currentOrder = order && typeof order === 'object' ? order : {};
  const finalAmount = resolveOrderFinalAmount(currentOrder);
  const giftWrapTotal = resolveOrderGiftWrapTotal(currentOrder);
  const shippingCost = resolveOrderShippingCost(currentOrder);
  const codCharge = resolveOrderCodCharge(currentOrder, shippingCost);
  return {
    ...currentOrder,
    finalAmount,
    giftWrapTotal,
    shippingCost,
    codCharge,
  };
};
