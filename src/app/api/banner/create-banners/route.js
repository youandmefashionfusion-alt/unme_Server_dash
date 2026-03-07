import connectDb from "../../../../../config/connectDb"
import authMiddleware from "../../../../../controller/authController"
import ScrollModel from "../../../../../models/bannersModel"
export async function POST(req){
    const {searchParams}=new URL(req.url)
    const token=searchParams.get("token")
    const body=await req.json()
    try{
        await connectDb()
        await authMiddleware(token)
        const scroll=await ScrollModel.create(body)
        if(scroll && scroll1){
            return Response.json(scroll)
        }

    }catch(error){
        return Response.json({success:false,message:error},{status:500})
    }
}