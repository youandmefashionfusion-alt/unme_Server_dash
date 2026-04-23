import connectDb from "../../../../../config/connectDb";
import AbondendModel from "../../../../../models/abandonedModel";
import "../../../../../models/productModel";
import { normalizeAbandonedOrder } from "../../../../lib/abandonedOrder";

export const config = {
  maxDuration: 10,
};

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const requestedLimit = parseInt(searchParams.get("limit") || "50", 10);
  const requestedPage = parseInt(searchParams.get("page") || "1", 10);
  const limit = Number.isNaN(requestedLimit) || requestedLimit <= 0 ? 50 : requestedLimit;
  const page = Number.isNaN(requestedPage) || requestedPage <= 0 ? 1 : requestedPage;

  try {
    await connectDb();

    const query = {};
    const totalOrders = await AbondendModel.countDocuments(query);
    const totalPages = Math.max(1, Math.ceil(totalOrders / limit));
    const safePage = Math.min(page, totalPages);
    const skip = (safePage - 1) * limit;

    const orders = await AbondendModel.find(query)
      .populate("orderItems.product")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    const normalizedOrders = orders.map((order) => normalizeAbandonedOrder(order));

    return Response.json({
      success: true,
      orders: normalizedOrders,
      currentPage: safePage,
      totalPages,
      totalOrders,
      hasMore: safePage < totalPages,
    });
  } catch (error) {
    console.error("Error fetching abandoned carts:", error);
    return Response.json(
      {
        success: false,
        message: "Server Error",
      },
      { status: 500 }
    );
  }
}
