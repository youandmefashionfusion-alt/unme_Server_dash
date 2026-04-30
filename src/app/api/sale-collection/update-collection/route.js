import connectDb from "../../../../../config/connectDb";
import SaleCollectionModel from "../../../../../models/saleCollectionModel";
import authMiddleware from "../../../../../controller/authController";

const toSeoHandle = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const getUniqueHandle = async (model, requestedHandle, currentId) => {
  const baseHandle = toSeoHandle(requestedHandle) || "collection";
  let candidate = baseHandle;
  let suffix = 2;

  while (
    await model.exists({
      handle: candidate,
      _id: { $ne: currentId },
    })
  ) {
    candidate = `${baseHandle}-${suffix}`;
    suffix += 1;
  }

  return candidate;
};

export async function PUT(request) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id") || ""
  const token = searchParams.get("token") || ""

  const body = await request.json()
  try {
    await connectDb()
    await authMiddleware(token)
    const uniqueHandle = await getUniqueHandle(
      SaleCollectionModel,
      body?.handle || body?.title,
      id
    );
    const payload = {
      ...body,
      handle: uniqueHandle,
    };

    const col = await SaleCollectionModel.findByIdAndUpdate(id, payload, {
      new: true,
    });
    if (col) {
      return Response.json(col)
    }
  } catch (error) {
    console.log(error)
    return Response.json({ success: false, message: error }, { status: 500 })
  }
}
