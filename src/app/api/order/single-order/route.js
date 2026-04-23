import OrderModel from "../../../../../models/orderModel";
import "../../../../../models/productModel";
import connectDb from "../../../../../config/connectDb";
import { normalizeOrderPricing } from "../../../../lib/orderPricing";

const isValidObjectId = (value) =>
  typeof value === "string" && /^[a-f\d]{24}$/i.test(value);

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!isValidObjectId(id)) {
    return Response.json(
      { success: false, message: "Invalid order id" },
      { status: 400 }
    );
  }

  try {
    await connectDb();
    const order = await OrderModel.findById(id).populate("orderItems.product");

    if (!order) {
      return Response.json(
        { success: false, message: "Order not found" },
        { status: 404 }
      );
    }

    const normalizedOrder = normalizeOrderPricing(order.toObject());
    return Response.json(normalizedOrder, { status: 200 });
  } catch (error) {
    console.error("single-order GET failed:", error);
    return Response.json(
      { success: false, message: "Server Error" },
      { status: 500 }
    );
  }
}
