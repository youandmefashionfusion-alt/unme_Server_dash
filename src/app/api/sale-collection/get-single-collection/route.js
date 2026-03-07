import connectDb from "../../../../../config/connectDb"
import SaleCollectionModel from "../../../../../models/saleCollectionModel";
export const config = {
  maxDuration: 10,
};
export async function GET(request){
    const {searchParams}=new URL(request.url)
    const id=searchParams.get("id") || ""
    try{
        await connectDb()
        if(id===""){
        return Response.json({status:400,message:"Not Enough Details"})   
        }
        const collection = await SaleCollectionModel.findById(id)

        if(collection){
            return Response.json(collection)
        }


    }
    catch(error){
        return Response.json({status:500,message:error})
    }
}