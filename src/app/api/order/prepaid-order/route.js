import connectDb from "../../../../../config/connectDb";
import authMiddleware from "../../../../../controller/authController";
import OrderModel from "../../../../../models/orderModel";
import { resolveOrderShippingCost } from "../../../../lib/orderPricing";

const toFiniteNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export async function PUT(request){
    const {searchParams}=new URL(request.url)
    const orderId  = searchParams.get("id")
    const token  = searchParams.get("token")

    try {
      await connectDb()
      await authMiddleware(token)

      const existingOrder = await OrderModel.findById(orderId);
      if (!existingOrder) {
        return Response.json({ message: "Order not found" }, { status: 404 });
      }

      const orderObject = existingOrder.toObject();
      const totalPrice = Math.max(toFiniteNumber(orderObject.totalPrice), 0);
      const discount = Math.max(toFiniteNumber(orderObject.discount), 0);
      const shippingCost = resolveOrderShippingCost(orderObject);
      const finalAmount = totalPrice + shippingCost - discount;

      existingOrder.orderType = 'Prepaid';
      existingOrder.shippingCost = shippingCost;
      existingOrder.codCharge = 0;
      existingOrder.finalAmount = finalAmount;

      const updatedOrder = await existingOrder.save();
      return Response.json({
        message: "Order Marked as Prepaid",
        order: updatedOrder,
      });
    } catch (error) {
      // Handle errors appropriately
      return Response.json({status:500,message:"Server Error",error:error},{status:500})
    }
  };
  
