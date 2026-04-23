import AbondendModel from "../../../../../models/abandonedModel";
import connectDb from "../../../../../config/connectDb";
import {
  ABANDONED_UPSERT_SKIP_ORDER_CREATION_IDS,
  compactObject,
  normalizeAbandonedOrderItems,
  normalizeAbandonedShippingInfo,
  resolveAbandonedGiftWrapTotal,
  toNumberOrFallback,
} from "../../../../lib/abandonedOrder";

export const config = {
  maxDuration: 10,
};

const toOptionalNumber = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
};

export async function POST(req) {
  try {
    const parsedBody = await req.json();
    const {
      shippingInfo,
      orderItems,
      totalPrice,
      finalAmount,
      shippingCost,
      orderType,
      discount,
      paymentInfo,
    } = parsedBody || {};

    const normalizedShippingInfo = normalizeAbandonedShippingInfo(shippingInfo || {});
    const sanitizedOrderItems = normalizeAbandonedOrderItems(orderItems || []);

    if (!sanitizedOrderItems.length) {
      return Response.json(
        { success: false, error: "Cannot create abandoned cart without items" },
        { status: 400 }
      );
    }

    await connectDb();

    const normalizedTotalPrice = toOptionalNumber(totalPrice);
    const normalizedFinalAmount = toOptionalNumber(finalAmount);
    const normalizedShippingCost = toOptionalNumber(shippingCost);
    const normalizedDiscount = toOptionalNumber(discount);
    const computedGiftWrapTotal = resolveAbandonedGiftWrapTotal({
      orderItems: sanitizedOrderItems,
    });

    const payload = {
      shippingInfo: normalizedShippingInfo,
      orderItems: sanitizedOrderItems,
      totalPrice: normalizedTotalPrice,
      finalAmount: normalizedFinalAmount,
      shippingCost: normalizedShippingCost,
      orderType,
      discount: normalizedDiscount,
      giftWrapTotal: computedGiftWrapTotal,
      paymentInfo: paymentInfo || {},
      orderCalled: "pending",
    };

    const orderCreationId = String(payload?.paymentInfo?.orderCreationId || "").trim();
    const shouldAttemptUpsert =
      Boolean(orderCreationId) &&
      !ABANDONED_UPSERT_SKIP_ORDER_CREATION_IDS.has(orderCreationId);

    if (shouldAttemptUpsert) {
      const existing = await AbondendModel.findOne({
        "paymentInfo.orderCreationId": orderCreationId,
      });

      if (existing) {
        const existingShipping = existing?.shippingInfo?.toObject
          ? existing.shippingInfo.toObject()
          : existing?.shippingInfo || {};
        const existingPaymentInfo = existing?.paymentInfo?.toObject
          ? existing.paymentInfo.toObject()
          : existing?.paymentInfo || {};

        existing.shippingInfo = {
          ...existingShipping,
          ...compactObject(payload.shippingInfo),
        };
        existing.paymentInfo = {
          ...existingPaymentInfo,
          ...compactObject(payload.paymentInfo),
        };
        existing.orderItems =
          Array.isArray(payload.orderItems) && payload.orderItems.length
            ? payload.orderItems
            : existing.orderItems;
        existing.totalPrice = toNumberOrFallback(payload.totalPrice, existing.totalPrice);
        existing.finalAmount = toNumberOrFallback(payload.finalAmount, existing.finalAmount);
        existing.shippingCost = toNumberOrFallback(payload.shippingCost, existing.shippingCost);
        existing.discount = toNumberOrFallback(payload.discount, existing.discount);
        existing.giftWrapTotal = toNumberOrFallback(payload.giftWrapTotal, existing.giftWrapTotal);
        existing.orderType = payload.orderType || existing.orderType;
        existing.orderCalled = existing.orderCalled || "pending";

        await existing.save();

        return Response.json(
          {
            success: true,
            status: "Abandoned Updated",
            abandonedId: existing._id,
          },
          { status: 200 }
        );
      }
    }

    let abandonedDoc = null;
    let lastError = null;

    // Retry on duplicate key because orderNumber is generated in pre-save.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        abandonedDoc = await AbondendModel.create(payload);
        break;
      } catch (error) {
        lastError = error;
        if (error?.code !== 11000) break;
      }
    }

    if (!abandonedDoc) {
      throw lastError || new Error("Failed to create abandoned cart");
    }

    return Response.json(
      {
        success: true,
        status: "Abandoned Created",
        abandonedId: abandonedDoc._id,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error Creating Abandoned:", error.message);
    return Response.json(
      { success: false, error: "Failed to create Abandoned" },
      { status: 500 }
    );
  }
}
