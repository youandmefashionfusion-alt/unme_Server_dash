import connectDb from "../../../../../config/connectDb";
import authMiddleware from "../../../../../controller/authController";
import ProductModel from "../../../../../models/productModel";
export async function DELETE(request){
    const {searchParams}=new URL(request.url)
    const id=searchParams.get("id")
    const token=searchParams.get("token")

  
    try {
        await connectDb()
        await authMiddleware(token)
      const deleteProduct = await ProductModel.findByIdAndDelete(id);
      if(deleteProduct){
        return Response.json({
            status:200,message:"Product Deleted"
        },{status:200})
      }
      else{
        return Response.json({
            status:400,message:"Unable to Delete Product"
        },{status:400})
      }

    } catch (error) {
        return Response.json({
            status:500,message:error
        },{status:500})
    }
  }