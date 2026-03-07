import BlogModel from "../../../../../models/blogModel";
import connectDb from "../../../../../config/connectDb";
import authMiddleware from "../../../../../controller/authController";

export async function DELETE(req){
    const body=await req.json()
    const {id,token}=body
    try{
        if(!id || !token){
        return Response.json({message:"Insufficient Information"},{status:404})

        }
        await connectDb()
        await authMiddleware(token)
        const blog=await BlogModel.findByIdAndDelete(id)
        if(blog){
            return Response.json(blog)
        }
        else{
        return Response.json({message:"Unable to delete blog"},{status:404})

        }

    }catch(err){
        console.log(err)
        return Response.json({err,message:"Unable to delete blog"},{status:500})
    }
}