import connectDb from "../../../../../config/connectDb";
import authMiddleware from "../../../../../controller/authController";
import ProductModel from "../../../../../models/productModel";
export async function PUT(request) {
    const {searchParams}=new URL(request.url)
    const id=searchParams.get("id")
    const token=searchParams.get("token")

    const body=await request.json()
    try {
        await connectDb()
        await authMiddleware(token)
      const payload = { ...body };

      // Normalize legacy payload keys.
      if (!Array.isArray(payload.sizes) && Array.isArray(payload.ringSize)) {
        payload.sizes = payload.ringSize;
      }
      delete payload.ringSize;
      delete payload.weight;

      const updateProduct = await ProductModel.findByIdAndUpdate(id , payload, {
        new: true,
      });
      if(updateProduct){
        return Response.json({
            status:200,message:"Product Created"
        },{status:200})
      }
      else{
        return Response.json({
            status:400,message:"Unable to Create Product"
        },{status:400})
      }
    } catch (error) {
      console.log(error.message)
        return Response.json({
            status:500,message:error
        },{status:500})
    }
  }
