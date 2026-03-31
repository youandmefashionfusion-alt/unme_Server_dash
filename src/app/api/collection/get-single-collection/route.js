import connectDb from "../../../../../config/connectDb"
import CollectionModel from "../../../../../models/collectionModel";
export const config = {
  maxDuration: 10,
};
export async function GET(request){
    const {searchParams}=new URL(request.url)
    const id=searchParams.get("id") || ""
    try{
        await connectDb()
        if(id===""){
        return Response.json({success:false,status:400,message:"Not Enough Details"}, { status: 400 })   
        }
        const collection = await CollectionModel.findById(id)

        if(collection){
            return Response.json(collection, { status: 200 })
        }

        return Response.json(
          { success: false, status: 404, message: "Collection not found" },
          { status: 404 }
        );

    }
    catch(error){
        return Response.json({success:false,status:500,message:error},{ status: 500 })
    }
}
