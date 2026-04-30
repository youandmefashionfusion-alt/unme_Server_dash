import connectDb from "../../../../../config/connectDb";
import CollectionModel from "../../../../../models/collectionModel";
import authMiddleware from "../../../../../controller/authController";

const normalizeStatus = (value) => {
  const normalized = String(value || "").toLowerCase();
  return normalized === "active" || normalized === "draft" ? normalized : "draft";
};

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
    if (!id) {
      return Response.json(
        { success: false, message: "Collection id is required" },
        { status: 400 }
      );
    }

    await connectDb()
    await authMiddleware(token)

    const uniqueHandle = await getUniqueHandle(
      CollectionModel,
      body?.handle || body?.title,
      id
    );

    const payload = {
      ...body,
      handle: uniqueHandle,
      status: normalizeStatus(body?.status),
    };

    const col = await CollectionModel.findByIdAndUpdate(id, payload, {
      new: true,
      runValidators: true,
    });

    if (col) {
      return Response.json(col)
    }

    return Response.json(
      { success: false, message: "Collection not found" },
      { status: 404 }
    );
  } catch (error) {
    console.log(error)
    return Response.json({ success: false, message: error }, { status: 500 })
  }
}
