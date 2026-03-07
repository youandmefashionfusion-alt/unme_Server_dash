import connectDb from "../../../../../config/connectDb";
import SaleCollectionModel from "../../../../../models/saleCollectionModel";
import authMiddleware from "../../../../../controller/authController";
export async function POST(request) {
    const {searchParams}=new URL(request.url)
    const token=searchParams.get("token") || ""

    const body=await request.json()
    try {
        await connectDb()
        await authMiddleware(token)
 
                let col=await SaleCollectionModel.create(body)

        
                if(col){
                    return Response.json(col)
                }
    } catch (error) {
        return Response.json({success:false,message:error},{status:500})   
    }
  }