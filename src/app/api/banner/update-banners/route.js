import connectDb from "../../../../../config/connectDb"
import authMiddleware from "../../../../../controller/authController"
import ScrollModel from "../../../../../models/bannersModel"

const getLatestBannerDoc = async () =>
    ScrollModel.findOne().sort({ createdAt: -1, _id: -1 })

const sanitizeBannerArray = (banners = []) =>
    Array.isArray(banners)
        ? banners.map((banner = {}) => ({
            url: String(banner?.url || "").trim(),
            title: String(banner?.title || "").trim(),
            subtitle: String(banner?.subtitle || "").trim(),
            link: String(banner?.link || "").trim(),
        }))
        : []

export async function PUT(request) {
    const { searchParams } = new URL(request.url)
    const body = await request.json()
    const token = searchParams.get("token") || ""
    const { desktopBanners = [], mobileBanners = [], otherBanners = [], budgetBanners = [] } = body

    try {
        await connectDb()
        await authMiddleware(token)

        const payload = {
            desktopBanners: sanitizeBannerArray(desktopBanners),
            mobileBanners: sanitizeBannerArray(mobileBanners),
            otherBanners: sanitizeBannerArray(otherBanners),
            budgetBanners: sanitizeBannerArray(budgetBanners),
        }

        // Always update the latest banner document so reads/writes stay in sync.
        let scrollDoc = await getLatestBannerDoc()

        // If no document exists, create one
        if (!scrollDoc) {
            scrollDoc = new ScrollModel(payload)
        } else {
            scrollDoc.desktopBanners = payload.desktopBanners
            scrollDoc.mobileBanners = payload.mobileBanners
            scrollDoc.otherBanners = payload.otherBanners
            scrollDoc.budgetBanners = payload.budgetBanners
        }

        // Save the document
        await scrollDoc.save()

        return Response.json({
            success: true,
            message: "Banners updated successfully",
            data: scrollDoc
        })

    } catch (error) {
        console.error("Error updating banners:", error)
        return Response.json(
            { success: false, message: error.message },
            { status: 500 }
        )
    }
}

export async function GET(request) {
    try {
        await connectDb()
        // Find the scroll document (there should be only one)
        const scrollDoc = await getLatestBannerDoc()

        // If no document exists, return empty arrays
        if (!scrollDoc) {
            return Response.json({
                desktopBanners: [],
                mobileBanners: [],
                otherBanners: [],
                budgetBanners: []
            })
        }

        return Response.json({
            desktopBanners: scrollDoc.desktopBanners || [],
            mobileBanners: scrollDoc.mobileBanners || [],
            otherBanners: scrollDoc.otherBanners || [],
            budgetBanners: scrollDoc.budgetBanners || []
        })

    } catch (error) {
        console.error("Error fetching banners:", error)
        return Response.json(
            { success: false, message: error.message },
            { status: 500 }
        )
    }
}

export async function DELETE(request) {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get("token") || ""
    const { bannerId, bannerType, index } = await request.json()

    try {
        await connectDb()
        await authMiddleware(token)

        if (!bannerType || index === undefined) {
            return Response.json(
                { success: false, message: "Banner type and index are required" },
                { status: 400 }
            )
        }

        // Find the latest scroll document
        const scrollDoc = await getLatestBannerDoc()
        if (!scrollDoc) {
            return Response.json(
                { success: false, message: "No banners found" },
                { status: 404 }
            )
        }

        // Remove the banner from the specific array
        if (bannerType === 'desktop' && scrollDoc.desktopBanners[index]) {
            scrollDoc.desktopBanners.splice(index, 1)
        } else if (bannerType === 'mobile' && scrollDoc.mobileBanners[index]) {
            scrollDoc.mobileBanners.splice(index, 1)
        } else if (bannerType === 'other' && scrollDoc.otherBanners[index]) {
            scrollDoc.otherBanners.splice(index, 1)
        }
        else if (bannerType === 'budget' && scrollDoc.budgetBanners[index]) {
            scrollDoc.budgetBanners.splice(index, 1)
        }
        else {
            return Response.json(
                { success: false, message: "Banner not found" },
                { status: 404 }
            )
        }

        await scrollDoc.save()

        return Response.json({
            success: true,
            message: "Banner deleted successfully"
        })

    } catch (error) {
        console.error("Error deleting banner:", error)
        return Response.json(
            { success: false, message: error.message },
            { status: 500 }
        )
    }
}
