import connectDb from "../../../../../config/connectDb";
import authMiddleware from "../../../../../controller/authController";
import OrderModel from "../../../../../models/orderModel";
import { CHECKOUT_STANDARD_GIFT_WRAP_CHARGE } from "../../../../lib/orderPricing";

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

const sanitizeOrderItems = (items) => {
  if (!Array.isArray(items)) return [];

  return items
    .map((item) => {
      const quantity = Math.max(toFiniteNumber(item?.quantity), 0);
      const product = getProductId(item?.product);
      const isGift = Boolean(item?.isGift);
      const giftWrap = Boolean(item?.giftWrap);
      const giftWrapCharge = giftWrap
        ? Math.max(
            toFiniteNumber(item?.giftWrapCharge) || CHECKOUT_STANDARD_GIFT_WRAP_CHARGE,
            0
          )
        : 0;

      return {
        ...item,
        product,
        quantity,
        isGift,
        giftWrap,
        giftWrapCharge,
        giftMessage: isGift ? sanitizeGiftMessage(item?.giftMessage) : "",
      };
    })
    .filter((item) => Boolean(item.product) && item.quantity > 0);
};

const getGiftWrapTotalFromItems = (items) => {
  if (!Array.isArray(items)) return 0;
  const hasGiftWrap = items.some((item) => Boolean(item?.giftWrap));
  return hasGiftWrap ? CHECKOUT_STANDARD_GIFT_WRAP_CHARGE : 0;
};

export async function PUT(request){
    const {searchParams}=new URL(request.url)
    const id = searchParams.get("id")
    const token = searchParams.get("token")

    const body=await request.json()
    try {
        await connectDb()
        await authMiddleware(token)
      const normalizedOrderItems = sanitizeOrderItems(body?.orderItems);
      if (!normalizedOrderItems.length) {
        return Response.json({
          status: 400,
          message: "Order must include at least one valid item",
        }, { status: 400 });
      }

      const orderType = body?.orderType || 'COD';
      const totalPrice = toFiniteNumber(body?.totalPrice);
      const shippingCost = toFiniteNumber(body?.shippingCost);
      const discount = Math.max(toFiniteNumber(body?.discount), 0);
      const giftWrapTotal = getGiftWrapTotalFromItems(normalizedOrderItems);
      const requestedCodCharge = Math.max(toFiniteNumber(body?.codCharge), 0);
      const codCharge = orderType === 'COD' ? requestedCodCharge : 0;
      const finalAmount = totalPrice + shippingCost + codCharge + giftWrapTotal - discount;

      const payload = {
        ...body,
        orderItems: normalizedOrderItems,
        totalPrice,
        shippingCost,
        discount,
        giftWrapTotal,
        codCharge,
        finalAmount,
      };

      const updatedOrder = await OrderModel.findByIdAndUpdate(id, payload, {
        new: true,
      });
      if(updatedOrder){
        return Response.json(updatedOrder)
      }
      else{
        return Response.json({
            status:400, message:"Unable to Update Order"
          },{status:400})
      }
    } catch (error) {
      return Response.json({
        status:500, message:"Server Error",error:error
      },{status:500})
    }
  }
