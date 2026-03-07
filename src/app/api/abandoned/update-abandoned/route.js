import connectDb from "../../../../../config/connectDb";
import authMiddleware from "../../../../../controller/authController";
import AbondendModel from "../../../../../models/abandonedModel"
export async function PUT(request){
    const {searchParams}=new URL(request.url)
    const id = searchParams.get("id")
    const token = searchParams.get("token")
    const body=await request.json()
    try {
        await connectDb()
        await authMiddleware(token)
      const updatedOrder = await AbondendModel.findByIdAndUpdate(id, body, {
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