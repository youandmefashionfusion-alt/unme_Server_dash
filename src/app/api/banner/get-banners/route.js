import connectDb from "../../../../../config/connectDb"
import ScrollModel from "../../../../../models/bannersModel"
export async function GET(request) {
    try {
        await connectDb()
        // Keep response shape as array for backward compatibility with current UI.
        const latestBannerDoc = await ScrollModel.findOne().sort({ createdAt: -1, _id: -1 })
        return Response.json(latestBannerDoc ? [latestBannerDoc] : [])
    }
    catch (error) {
        return Response.json({ status: 500, message: error })
    }
}
