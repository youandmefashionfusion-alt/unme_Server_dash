import connectDb from "../../../../../config/connectDb";
import CollectionModel from "../../../../../models/collectionModel";
import authMiddleware from "../../../../../controller/authController";
export async function POST(request) {
    const {searchParams}=new URL(request.url)
    const token=searchParams.get("token") || ""

    const body=await request.json()
    try {
        await connectDb()
        await authMiddleware(token)
 
                let col=await CollectionModel.create(body)

        
                if(col){
                    return Response.json(col)
                }
    } catch (error) {
        return Response.json({success:false,message:error},{status:500})   
    }
  }