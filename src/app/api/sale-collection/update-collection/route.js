import connectDb from "../../../../../config/connectDb";
import SaleCollectionModel from "../../../../../models/saleCollectionModel";
import authMiddleware from "../../../../../controller/authController";

export async function PUT(request) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id") || ""
  const token = searchParams.get("token") || ""

  const body = await request.json()
  try {
    await connectDb()
    await authMiddleware(token)
    const col = await SaleCollectionModel.findByIdAndUpdate(id, body, {
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