import connectDb from "../../../../../config/connectDb";
import authMiddleware from "../../../../../controller/authController";
import CouponModel from "../../../../../models/couponModel";
export async function POST(request) {
    const {searchParams}=new URL(request.url)
    const token=searchParams.get("token")
    const body=await request.json()
    try {
        await connectDb()
        await authMiddleware(token)
        
                const data=await CouponModel.create(body)
        
                if(data){
                    return Response.json(data)
                }
    } catch (error) {
        return Response.json({success:false,message:error},{status:500})   
    }
  }