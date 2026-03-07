import ProductModel from "../../../../../models/productModel";
import connectDb from "../../../../../config/connectDb";
export const config = {
  maxDuration: 10,
};
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  try{
    await connectDb()
    let productHandle;
    if (searchParams.get("productHandle")) {
        productHandle = searchParams.get("productHandle");
      }

      const product=await ProductModel.find({handle:productHandle})
      return Response.json(
        {
          success: true,
          product
        },
        { status: 200 }
      );

  }
  catch (error) {
    console.error("Error fetching product:", error.message);
    return Response.json(
      { success: false, error: "Failed to fetch product" },
      { status: 500 }
    );
  }

}