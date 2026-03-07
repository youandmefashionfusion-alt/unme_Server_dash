import ProductModel from "../../../../../models/productModel";
import connectDb from "../../../../../config/connectDb";

export const config = {
  maxDuration: 10,
};

export async function GET(request) {
  try {
    await connectDb();

    const { searchParams } = new URL(request.url);
    const collectionHandle = searchParams.get("collectionHandle");

    if (!collectionHandle) {
      return new Response(JSON.stringify({
        success: false,
        error: "Missing collectionHandle parameter"
      }), { status: 400 });
    }

    const randomProducts = await ProductModel.aggregate([
      {
        $match: {
          state: "active",
          collectionHandle: collectionHandle,
          variants: {
            $elemMatch: {
              quantity: { $gt: 1 }
            }
          }
        }
      },
      { $sample: { size: 4 } } // Randomly select 4 products
    ]);

    return Response.json({
      success: true,
      products: randomProducts
    }, { status: 200 });

  } catch (error) {
    console.error("Error fetching random products:", error.message);
    return new Response(JSON.stringify({
      success: false,
      error: "Failed to fetch random products"
    }), { status: 500 });
  }
}
