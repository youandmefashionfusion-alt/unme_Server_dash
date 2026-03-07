import ProductModel from "../../../../models/productModel";
import connectDb from "../../../../config/connectDb";

export const config = {
  maxDuration: 20,
};

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const productHandle = searchParams.get("productHandle");

  if (!productHandle) {
    return Response.json(
      { success: false, error: "Product handle is required" },
      { status: 400 }
    );
  }

  try {
    await connectDb();

    // Get product and populate collection data
    const product = await ProductModel.findOne({
      handle: productHandle,
      state: "active"
    })
      .populate("collectionName", "title handle") // Only populate name and handle fields
      .lean();

    if (!product) {
      return Response.json(
        { success: false, error: "Product not found" },
        { status: 404 }
      );
    }

    // Get related products from same collection
    // Filter by products that have quantity > 0
    const relatedProducts = await ProductModel.find({
      state: "active",
      collectionHandle: product.collectionHandle,
      _id: { $ne: product._id },
      quantity: { $gt: 0 } 
    })
      .limit(4) // Increased to 8 for better variety
      .lean();

    // You might also want to get products from the same collection even if out of stock
    // as a fallback if there aren't enough in-stock items
    let finalRelatedProducts = relatedProducts;
    
    if (relatedProducts.length < 4) {
      const additionalProducts = await ProductModel.find({
        state: "active",
        collectionHandle: product.collectionHandle,
        _id: { 
          $ne: product._id,
          $nin: relatedProducts.map(p => p._id) // Exclude already fetched products
        }
      })
        .limit(4 - relatedProducts.length)
        .lean();
      
      finalRelatedProducts = [...relatedProducts, ...additionalProducts];
    }
    return Response.json({
      success: true,
      product: product,
      relatedProducts: finalRelatedProducts || []
    }, {
      status: 200
    });

  } catch (error) {
    console.error("Error in single product API:", error.message);
    return Response.json(
      { success: false, error: "Failed to fetch product data" },
      { status: 500 }
    );
  }
}