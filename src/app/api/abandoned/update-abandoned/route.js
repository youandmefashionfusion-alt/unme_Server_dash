import connectDb from "../../../../../config/connectDb";
import authMiddleware from "../../../../../controller/authController";
import AbondendModel from "../../../../../models/abandonedModel"
import { CHECKOUT_STANDARD_GIFT_WRAP_CHARGE } from "../../../../lib/orderPricing";

const toFiniteNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const hasNumericValue = (value) => {
  if (value === null || value === undefined || value === "") return false;
  return Number.isFinite(Number(value));
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
      const sanitizedOrderItems = sanitizeOrderItems(body?.orderItems);
      const giftWrapTotal = getGiftWrapTotalFromItems(sanitizedOrderItems);

      const totalPrice = Math.max(toFiniteNumber(body?.totalPrice), 0);
      const shippingCost = Math.max(toFiniteNumber(body?.shippingCost), 0);
      const discount = Math.max(toFiniteNumber(body?.discount), 0);
      const inferredFinalAmount = totalPrice + giftWrapTotal + shippingCost - discount;
      const finalAmount = hasNumericValue(body?.finalAmount)
        ? Math.max(toFiniteNumber(body?.finalAmount), 0)
        : inferredFinalAmount;

      const payload = {
        ...body,
        orderItems: sanitizedOrderItems.length ? sanitizedOrderItems : body?.orderItems,
        giftWrapTotal,
        totalPrice,
        shippingCost,
        discount,
        finalAmount,
      };

      const updatedOrder = await AbondendModel.findByIdAndUpdate(id, payload, {
        new: true,
      });
      if(updatedOrder){
        return Response.json(updatedOrder)
      }
      else{
        return Response.json({
            status:400, message:"Unable to Update Abandoned",error:error
          })
      }
    } catch (error) {
      return Response.json({
        success:false, message:"Server Error",error:error
      },{status:500})
    }
  }
