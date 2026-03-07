import connectDb from "../../../../../config/connectDb";
import authMiddleware from "../../../../../controller/authController";
import OrderModel from "../../../../../models/orderModel";
export async function PUT(request){
    const {searchParams}=new URL(request.url)
    const id = searchParams.get("id")
    const token = searchParams.get("token")

    try {
        await connectDb()
        await authMiddleware(token)
      // Fetch the order
      const order = await OrderModel.findById(id);
  
      if (!order) {
        return Response.json({ message: "Order not found" },{status:400});
      }
  
      order.orderCalled = 'Called';

      await order.save();
  
      return Response.json({ message: "Order Confirmed successfully" });
    } catch (error) {
      console.error("Error Confirming order:", error);
      return Response.json({ message: "Server Error" },{status:500});
    }
  }