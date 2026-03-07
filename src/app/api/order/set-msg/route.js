import connectDb from "../../../../../config/connectDb";
import OrderModel from "../../../../../models/orderModel";
export async function PUT(req){
    const body=await req.json()
    const { name, message, time,orderId } = body;

    try {
        await connectDb()
  
        // Update product with new rating and comment
        const messageOrder = await OrderModel.findByIdAndUpdate(
            orderId,
            {
                $push: {
                    orderComment: {
                        name: name,
                        message: message,
                        time: time,
                        orderId: orderId,
                    },
                },
            },
            { new: true }
        );
  
        // Calculate new average rating for the product
  
        // Update product with new average rating
        const updatedOrder = await OrderModel.findByIdAndUpdate(
            orderId,
            { new: true }
        );
  
        return Response.json(updatedOrder);
    } catch (error) {
        console.error("Error while updating comment:", error);
        return Response.json({status:500, message: "Internal server error" });
    }
  }