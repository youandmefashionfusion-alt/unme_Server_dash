import connectDb from "../../../../../config/connectDb";
import ProductModel from "../../../../../models/productModel";
export async function POST(req) {
    const body=await req.json()
    const { productIds } = body;
    try {
        await connectDb()
      const updates = productIds.map((id, index) =>
        ({ updateOne: { filter: { _id: id }, update: { $set: { order: index } } } })
      );
  
      await ProductModel.bulkWrite(updates);
  
      return Response.json({status:200, message: "Products reordered successfully" });
    } catch (error) {
      console.error('Error reordering products:', error);
      return Response.json({status:500, error: 'Internal server error' });
    }
  }