import connectDb from "../../../../../config/connectDb";
import SaleCollectionModel from "../../../../../models/saleCollectionModel";
import authMiddleware from "../../../../../controller/authController";

export async function DELETE(request) {
    const {searchParams}=new URL(request.url)
    const id=searchParams.get("id") || ""
    const token=searchParams.get("token") || ""

    try {
        await connectDb()
        await authMiddleware(token)
        const col= await SaleCollectionModel.findByIdAndDelete(id)

                if(col){
                    return Response.json(col)
                }
    } catch (error) {
        return Response.json({success:false,message:error},{status:500})   
    }
  }