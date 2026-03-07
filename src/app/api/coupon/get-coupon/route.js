import connectDb from "../../../../../config/connectDb"
import CouponModel from "../../../../../models/couponModel"; // Import your Coupon model

export async function GET(request){
    const {searchParams}=new URL(request.url)
    const id=searchParams.get("id") || ""
    try{
        await connectDb()
        const coupon=await CouponModel.findById(id)
        if(coupon){
            return Response.json(coupon)
        }
        else{
        return Response.json({status:400,message:"Unable to fetch Coupon"},{status:400})

        }

    }catch(err){
        return Response.json({status:500,message:err})
    }
}