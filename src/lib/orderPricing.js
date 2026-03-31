export const CHECKOUT_FREE_SHIPPING_THRESHOLD = 999;
export const CHECKOUT_STANDARD_SHIPPING_CHARGE = 99;
export const CHECKOUT_STANDARD_COD_CHARGE = 99;

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
  const finalAmount = Math.max(toFiniteNumber(currentOrder.finalAmount), 0);
  const discount = Math.max(toFiniteNumber(currentOrder.discount), 0);
  const normalizedOrderType = String(currentOrder.orderType || '').toUpperCase();

  const codChargeForDerivation =
    normalizedOrderType === 'COD'
      ? hasNumericValue(currentOrder.codCharge)
        ? Math.max(toFiniteNumber(currentOrder.codCharge), 0)
        : CHECKOUT_STANDARD_COD_CHARGE
      : 0;

  const derivedShipping = finalAmount + discount - subtotal - codChargeForDerivation;
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
  const finalAmount = Math.max(toFiniteNumber(currentOrder.finalAmount), 0);
  const discount = Math.max(toFiniteNumber(currentOrder.discount), 0);
  const shippingCost = Number.isFinite(Number(resolvedShippingCost))
    ? Math.max(toFiniteNumber(resolvedShippingCost), 0)
    : resolveOrderShippingCost(currentOrder);
  const storedCodCharge = hasNumericValue(currentOrder.codCharge)
    ? Math.max(toFiniteNumber(currentOrder.codCharge), 0)
    : null;

  const derivedCodCharge = finalAmount + discount - subtotal - shippingCost;
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

export const normalizeOrderPricing = (order = {}) => {
  const currentOrder = order && typeof order === 'object' ? order : {};
  const shippingCost = resolveOrderShippingCost(currentOrder);
  const codCharge = resolveOrderCodCharge(currentOrder, shippingCost);
  return {
    ...currentOrder,
    shippingCost,
    codCharge,
  };
};
