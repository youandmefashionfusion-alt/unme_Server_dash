import ProductModel from "../../../../../models/productModel";
import connectDb from "../../../../../config/connectDb";
import mongoose from "mongoose";
export const config = {
  maxDuration: 10,
};
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  try {
    await connectDb();

    const rawValue = searchParams.get("id") || searchParams.get("productHandle");
    if (!rawValue) {
      return Response.json(
        { success: false, error: "Product identifier is required" },
        { status: 400 }
      );
    }

    const filter = mongoose.Types.ObjectId.isValid(rawValue)
      ? { $or: [{ _id: rawValue }, { handle: rawValue }] }
      : { handle: rawValue };

    const productDoc = await ProductModel.findOne(filter)
      .populate("collectionName")
      .populate("saleCollections");

    if (!productDoc) {
      return Response.json(
        { success: false, error: "Product not found" },
        { status: 404 }
      );
    }

    const product = productDoc?.toObject ? productDoc.toObject() : productDoc;

    // Backward compatibility for older products saved with `ringSize`.
    if (product && !Array.isArray(product.sizes) && Array.isArray(product.ringSize)) {
      product.sizes = product.ringSize;
    }

    if (product && Object.prototype.hasOwnProperty.call(product, "weight")) {
      delete product.weight;
    }

    return Response.json(
      {
        success: true,
        product,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching product:", error.message);
    return Response.json(
      { success: false, error: "Failed to fetch product" },
      { status: 500 }
    );
  }
}
