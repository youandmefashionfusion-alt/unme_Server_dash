import connectDb from "../../../../../config/connectDb";
import authMiddleware from "../../../../../controller/authController";
import OrderModel from "../../../../../models/orderModel";
import ProductModel from "../../../../../models/productModel";
export async function PUT(request){
    const {searchParams}=new URL(request.url)
    const orderId  = searchParams.get("id")
    const token  = searchParams.get("token")

    try {
        await connectDb()
        await authMiddleware(token)
      // Fetch the order
      const order = await OrderModel.findById(orderId);

  
      if (!order) {
        return Response.json({status:400, message: "Order not found" },{status:400});
      }
  
      // Retrieve order items
      const orderItems = order.orderItems;
  
      // Increase inventory for each order item
      for (const orderItem of orderItems) {
        const { product, quantity } = orderItem;
        const productId = product._id;
  
        // Find the product in the database
        const foundProduct = await ProductModel.findById(productId);

  
        // Find the variant matching the color and size
          // Check if there is enough quantity available
          if (foundProduct.quantity >= quantity) {
            // Subtract the ordered quantity from the variant's quantity
            foundProduct.quantity -= quantity;
            foundProduct.sold += quantity;
            await foundProduct.save();

          } else {
            console.error(`Not enough quantity available`)
            return;
          }
      }
  
      // Update order type to 'Cancelled'
      order.orderType = 'COD';

      await order.save();

  
      return Response.json({message:"Order Retrieved"})
    } catch (error) {
      console.error("Error cancelling order:", error);
      return Response.json({success:false,message:"Server Error",error:error},{status:500})
    }
  }