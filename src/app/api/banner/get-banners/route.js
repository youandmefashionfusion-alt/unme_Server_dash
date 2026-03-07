import connectDb from "../../../../../config/connectDb"
import ScrollModel from "../../../../../models/bannersModel"
export async function GET(request) {
    try {
        await connectDb()
        const banners = await ScrollModel.find().sort({ createdAt: -1 })
        return Response.json(banners)
    }
    catch (error) {
        return Response.json({ status: 500, message: error })
    }
}