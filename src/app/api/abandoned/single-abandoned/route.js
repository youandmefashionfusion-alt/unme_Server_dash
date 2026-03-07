import connectDb from "../../../../../config/connectDb"
import AbondendModel from "../../../../../models/abandonedModel"
import ProductModel from "../../../../../models/productModel"
export async function GET(request){
    const {searchParams}=new URL(request.url)
    const id = searchParams.get("id")

    try{
      await connectDb()
      const order=await AbondendModel.findById(id).populate("orderItems.product")
      if(order){
        return Response.json(order)
      }
     else{
        return Response.json({status:400,message:"Unable to get order"})
     }
    }
    catch(error){
        return Response.json({success:false,message:"Server Error"},{status:500})
    }
  }