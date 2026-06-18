import connectDb from "../../../../../config/connectDb";
import authMiddleware from "../../../../../controller/authController";
import OrderModel from "../../../../../models/orderModel";
import ProductModel from "../../../../../models/productModel";
import { CHECKOUT_STANDARD_GIFT_WRAP_CHARGE } from "../../../../lib/orderPricing";

const toFiniteNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const sanitizeGiftMessage = (message) => String(message || "").trim().slice(0, 180);

const getProductId = (product) => {
  if (!product) return "";
  if (typeof product === "string") return product;
  if (typeof product === "object") {
    // Populated product document.
    if (product._id) return String(product._id);
    // Raw ObjectId (e.g. from a .lean() order) stringifies to its hex id.
    return String(product);
  }
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

// Sum ordered quantity per product id (an order may hold the same product in
// more than one line item, so we aggregate to be safe).
const buildQuantityMap = (items) => {
  const map = new Map();
  if (!Array.isArray(items)) return map;
  for (const item of items) {
    const productId = getProductId(item?.product);
    if (!productId) continue;
    const quantity = Math.max(toFiniteNumber(item?.quantity), 0);
    map.set(productId, (map.get(productId) || 0) + quantity);
  }
  return map;
};

// Reconcile inventory for the difference between the old and new order items.
// delta = newQty - oldQty. We reduce stock by the delta and raise `sold` by the
// same amount, so a negative delta (qty reduced or item removed) restocks the
// product. Best-effort: failures are logged, never blocking the order update.
const reconcileInventory = async (oldItems, newItems) => {
  try {
    const oldMap = buildQuantityMap(oldItems);
    const newMap = buildQuantityMap(newItems);
    const productIds = new Set([...oldMap.keys(), ...newMap.keys()]);

    await Promise.all(
      [...productIds].map((productId) => {
        const delta = (newMap.get(productId) || 0) - (oldMap.get(productId) || 0);
        if (delta === 0) return null;
        // Atomic update avoids read-modify-write races between concurrent edits.
        return ProductModel.findByIdAndUpdate(productId, {
          $inc: { quantity: -delta, sold: delta },
        });
      })
    );
  } catch (error) {
    console.error("Error reconciling inventory on order update:", error.message);
  }
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

      // Capture the previous items before the update so we can adjust inventory
      // by the difference (added/removed/changed quantities).
      const existingOrder = await OrderModel.findById(id).lean();

      const updatedOrder = await OrderModel.findByIdAndUpdate(id, payload, {
        new: true,
      });
      if(updatedOrder){
        await reconcileInventory(existingOrder?.orderItems, normalizedOrderItems);
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
