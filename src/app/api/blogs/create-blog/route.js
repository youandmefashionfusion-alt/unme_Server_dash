import BlogModel from "../../../../../models/blogModel";
import connectDb from "../../../../../config/connectDb";
import authMiddleware from "../../../../../controller/authController";
export const config = {
    maxDuration: 10,
  };
export async function POST(req){
    const body=await req.json()
    const {data,token}=body
    try{
        if(!token || !body){
        return Response.json({message:"Insufficient Information"},{status:404})

        }
        await connectDb()
        await authMiddleware(token)
        const blog=await BlogModel.create(data)

        if(blog){
            return Response.json(blog)
        }
        else{
        return Response.json({message:"Unable to create blog"},{status:404})

        }

    }catch(err){
        console.log(err)
        return Response.json({err,message:"Unable to create blog"},{status:500})
    }
}