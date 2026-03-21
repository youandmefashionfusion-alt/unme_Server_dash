import connectDb from "../../../../../config/connectDb";
import authMiddleware from "../../../../../controller/authController";
import ProductModel from "../../../../../models/productModel";

export async function POST(req) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  const body = await req.json();

  try {
    await connectDb();
    await authMiddleware(token);

    const payload = { ...body };

    // Normalize legacy payload keys.
    if (!Array.isArray(payload.sizes) && Array.isArray(payload.ringSize)) {
      payload.sizes = payload.ringSize;
    }
    delete payload.ringSize;
    delete payload.weight;

    let baseSlug = payload.handle;
    let finalSlug = baseSlug;
    let count = 1;

    // Check if slug already exists
    while (await ProductModel.findOne({ handle: finalSlug })) {
      finalSlug = `${baseSlug}-${count}`;
      count++;
    }

    payload.handle = finalSlug;

    await ProductModel.create(payload);

    return Response.json(
      {
        status: 200,
        message: "Product Created",
        slug: finalSlug,
      },
      { status: 200 }
    );

  } catch (error) {
    return Response.json(
      {
        status: 500,
        message: error.message || "Server Error",
      },
      { status: 500 }
    );
  }
}
