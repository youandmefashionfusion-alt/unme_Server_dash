import mongoose from "mongoose";
import connectDb from "../../../../../config/connectDb"
import CollectionModel from "../../../../../models/collectionModel";
export const config = {
  maxDuration: 10,
};
export async function GET(request){
    const {searchParams}=new URL(request.url)
    const id=(searchParams.get("id") || "").trim()
    try{
        await connectDb()
        if(id===""){
        return Response.json({success:false,status:400,message:"Collection id is required"}, { status: 400 })   
        }

        if (!mongoose.Types.ObjectId.isValid(id)) {
          return Response.json(
            { success: false, status: 400, message: "Invalid collection id" },
            { status: 400 }
          );
        }
        const collection = await CollectionModel.findById(id).lean()

        if(collection){
            return Response.json(collection, { status: 200 })
        }

        return Response.json(
          { success: false, status: 404, message: "Collection not found" },
          { status: 404 }
        );

    }
    catch(error){
        return Response.json(
          { success: false, status: 500, message: error?.message || "Server Error" },
          { status: 500 }
        )
    }
}
