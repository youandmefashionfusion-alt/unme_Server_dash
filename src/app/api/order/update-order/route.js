import connectDb from "../../../../../config/connectDb";
import authMiddleware from "../../../../../controller/authController";
import OrderModel from "../../../../../models/orderModel";
export async function PUT(request){
    const {searchParams}=new URL(request.url)
    const id = searchParams.get("id")
    const token = searchParams.get("token")

    const body=await request.json()
    try {
        await connectDb()
        await authMiddleware(token)
      const updatedOrder = await OrderModel.findByIdAndUpdate(id, body, {
        new: true,
      });
      if(updatedOrder){
        return Response.json(updatedOrder)
      }
      else{
        return Response.json({
            status:400, message:"Unable to Update Order",error:error
          },{status:400})
      }
    } catch (error) {
      return Response.json({
        status:500, message:"Server Error",error:error
      },{status:500})
    }
  }