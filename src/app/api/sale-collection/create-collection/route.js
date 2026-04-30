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
                    SaleCollectionModel,
                    body?.handle || body?.title
                );

                let col=await SaleCollectionModel.create({
                    ...body,
                    handle: uniqueHandle,
                })

        
                if(col){
                    return Response.json(col)
                }
    } catch (error) {
        return Response.json({success:false,message:error},{status:500})   
    }
  }
