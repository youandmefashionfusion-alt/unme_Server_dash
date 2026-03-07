import BlogModel from "../../../../../models/blogModel";
import connectDb from "../../../../../config/connectDb";
export const config = {
    maxDuration: 10,
  };
export async function GET(){
    try{
        await connectDb()
        const blogs=await BlogModel.find({state:"active"}).sort({createdAt:-1})
        if(blogs){
            return Response.json(blogs)
        }
        else{
        return Response.json({message:"No Blogs Find"},{status:404})

        }

    }catch(err){
        console.log(err)
        return Response.json({err,message:"Unable to find blogs"},{status:500})
    }
}