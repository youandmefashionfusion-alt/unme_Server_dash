import connectDb from "../../../../../config/connectDb";
import authMiddleware from "../../../../../controller/authController";
import AbondendModel from "../../../../../models/abandonedModel"
import {
  compactObject,
  normalizeAbandonedOrderItems,
  normalizeAbandonedShippingInfo,
  resolveAbandonedFinalAmount,
  resolveAbandonedGiftWrapTotal,
  toNumberOrFallback,
} from "../../../../lib/abandonedOrder";

const toOptionalNonNegativeNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(parsed, 0) : undefined;
};

export async function PUT(request){
    const {searchParams}=new URL(request.url)
    const id = searchParams.get("id")
    const token = searchParams.get("token")
    const body=await request.json()
    try {
        await connectDb()
        await authMiddleware(token)
      const existing = await AbondendModel.findById(id);
      if (!existing) {
        return Response.json(
          { success: false, message: "Abandoned cart not found" },
          { status: 404 }
        );
      }

      const sanitizedOrderItems = normalizeAbandonedOrderItems(body?.orderItems || []);
      const normalizedShippingInfo = normalizeAbandonedShippingInfo(body?.shippingInfo || {});
      const totalPriceInput = toOptionalNonNegativeNumber(body?.totalPrice);
      const shippingCostInput = toOptionalNonNegativeNumber(body?.shippingCost);
      const discountInput = toOptionalNonNegativeNumber(body?.discount);
      const resolvedOrderItems =
        Array.isArray(sanitizedOrderItems) && sanitizedOrderItems.length
          ? sanitizedOrderItems
          : Array.isArray(existing?.orderItems)
            ? existing.orderItems
            : [];
      const giftWrapTotal = resolveAbandonedGiftWrapTotal({
        giftWrapTotal: body?.giftWrapTotal,
        orderItems: resolvedOrderItems,
      });
      const finalAmount = resolveAbandonedFinalAmount({
        finalAmount: body?.finalAmount,
        totalPrice: toNumberOrFallback(totalPriceInput, existing.totalPrice),
        shippingCost: toNumberOrFallback(shippingCostInput, existing.shippingCost),
        discount: toNumberOrFallback(discountInput, existing.discount),
        giftWrapTotal,
        orderItems: resolvedOrderItems,
      });

      const existingShipping = existing?.shippingInfo?.toObject
        ? existing.shippingInfo.toObject()
        : existing?.shippingInfo || {};
      const existingPaymentInfo = existing?.paymentInfo?.toObject
        ? existing.paymentInfo.toObject()
        : existing?.paymentInfo || {};

      existing.shippingInfo = {
        ...existingShipping,
        ...compactObject(normalizedShippingInfo),
      };
      existing.paymentInfo = {
        ...existingPaymentInfo,
        ...compactObject(body?.paymentInfo || {}),
      };
      existing.orderItems =
        Array.isArray(sanitizedOrderItems) && sanitizedOrderItems.length
          ? sanitizedOrderItems
          : existing.orderItems;
      existing.totalPrice = toNumberOrFallback(totalPriceInput, existing.totalPrice);
      existing.finalAmount = toNumberOrFallback(finalAmount, existing.finalAmount);
      existing.shippingCost = toNumberOrFallback(shippingCostInput, existing.shippingCost);
      existing.discount = toNumberOrFallback(discountInput, existing.discount);
      existing.giftWrapTotal = toNumberOrFallback(giftWrapTotal, existing.giftWrapTotal);
      existing.orderType = body?.orderType || existing.orderType;
      existing.orderCalled = body?.orderCalled || existing.orderCalled || "pending";

      await existing.save();

      return Response.json(existing)
    } catch (error) {
      return Response.json({
        success:false, message:"Server Error",error:error
      },{status:500})
    }
  }
