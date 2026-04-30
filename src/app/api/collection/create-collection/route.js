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

const getUniqueHandle = async (model, requestedHandle) => {
  const baseHandle = toSeoHandle(requestedHandle) || "collection";
  let candidate = baseHandle;
  let suffix = 2;

  while (await model.exists({ handle: candidate })) {
    candidate = `${baseHandle}-${suffix}`;
    suffix += 1;
  }

  return candidate;
};

export async function POST(request) {
    const {searchParams}=new URL(request.url)
    const token=searchParams.get("token") || ""

    const body=await request.json()
    try {
        await connectDb()
        await authMiddleware(token)

        const uniqueHandle = await getUniqueHandle(
          CollectionModel,
          body?.handle || body?.title
        );

        const payload = {
          ...body,
          handle: uniqueHandle,
          status: normalizeStatus(body?.status),
        };

        const col = await CollectionModel.create(payload)

        if(col){
            return Response.json(col, { status: 201 })
        }

        return Response.json(
          { success: false, message: "Unable to create collection" },
          { status: 400 }
        );
    } catch (error) {
        return Response.json({success:false,message:error},{status:500})   
    }
  }
