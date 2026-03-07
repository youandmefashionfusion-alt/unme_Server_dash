import ProductModel from "../../../../../models/productModel";
import connectDb from "../../../../../config/connectDb";
export const config = {
  maxDuration: 10,
};
export async function GET(request) {
  try {
    await connectDb();

    // Fetch featured products

    // Fetch latest products
    const latestProducts = await ProductModel.find({state:"active"}).sort({ updatedAt: -1 }).limit(8);

    return Response.json(
      {
        success: true,
        data: {
         latestProducts
        },
      },
      {
        status: 200,
       
      }
    )
    
  } catch (error) {
    console.error("Error fetching featured products:", error.message);

    return new Response(
      JSON.stringify({
        success: false,
        error: "Failed to fetch products",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
