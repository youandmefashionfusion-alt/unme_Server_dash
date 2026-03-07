import connectDb from "../../../../../config/connectDb";
import authMiddleware from "../../../../../controller/authController";
import ProductModel from "../../../../../models/productModel";

export async function PUT(req) {
  try {
    const body = await req.json();
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");

    if (!token) {
      return Response.json(
        { status: false, msg: "Token is required" },
        { status: 401 }
      );
    }

    const { prodId, saleName, saleValue } = body;

    if (!prodId || !saleName) {
      return Response.json(
        { status: false, msg: "prodId and saleName are required" },
        { status: 400 }
      );
    }

    await connectDb();
    await authMiddleware(token);

    const saleFieldMap = {
      "999Sale": "is999Sale",
      "899Sale": "is899Sale",
      "1499Sale": "is1499Sale",
    };

    const updateField = saleFieldMap[saleName];

    if (!updateField) {
      return Response.json(
        { status: false, msg: "Invalid offer type" },
        { status: 400 }
      );
    }

    const updatedProduct = await ProductModel.findByIdAndUpdate(
      prodId,
      { [updateField]: saleValue },
      { new: true }
    );

    if (!updatedProduct) {
      return Response.json(
        { status: false, msg: "Product not found" },
        { status: 404 }
      );
    }

    return Response.json(
      {
        status: true,
        msg: `Product updated for ${saleName}`,
        data: updatedProduct,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error while updating offer:", error);
    return Response.json(
      { status: false, msg: "Internal server error" },
      { status: 500 }
    );
  }
}
