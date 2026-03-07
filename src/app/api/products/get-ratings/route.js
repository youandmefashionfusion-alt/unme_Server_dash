import connectDb from "../../../../../config/connectDb";
import ProductModel from "../../../../../models/productModel";
export async function GET(req) {
  try {
    await connectDb();

    // Fetch only products that have at least one rating
    const allProducts = await ProductModel.find({ "ratings.0": { $exists: true } });

    const latestRatings = [];

    for (const product of allProducts) {
      const sortedRatings = [...product.ratings].sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      );

      if (sortedRatings.length > 0) {
        latestRatings.push({
          productId: product._id,
          title: product.title,
          handle: product.handle,
          images: product.images || [],
          latestRating: sortedRatings[0],
        });
      }

      if (latestRatings.length === 10) break;
    }

    return Response.json({ success: true, ratings: latestRatings },{status:200})

  } catch (error) {
    console.error("Error fetching ratings:", error);
    return Response.json({ success: false, message: "Failed to fetch ratings" },{ status: 500 });
  }
}
