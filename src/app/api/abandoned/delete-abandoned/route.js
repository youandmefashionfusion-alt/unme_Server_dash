import connectDb from "../../../../../config/connectDb";
import authMiddleware from "../../../../../controller/authController";
import AbondendModel from "../../../../../models/abandonedModel";
export async function DELETE(request){
    const {searchParams}=new URL(request.url)
    const id=searchParams.get("id")
    const token=searchParams.get("token")

  
    try {
        await connectDb()
        await authMiddleware(token)
      const deleteAban= await AbondendModel.findByIdAndDelete(id);
      if(deleteAban){
        return Response.json({
            status:200,message:"Abandoned Deleted"
        })
      }
      else{
        return Response.json({
            status:400,message:"Unable to Delete Product"
        })
      }

    } catch (error) {
        return Response.json({
            success:false,message:error
        },{status:500})
    }
  }