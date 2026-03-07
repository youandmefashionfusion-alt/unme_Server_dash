import connectDb from "../../../../../config/connectDb";
import OrderModel from "../../../../../models/orderModel";
import ProductModel from "../../../../../models/productModel";

function buildFilterQuery(filter) {
  switch (filter) {
    case 'confirmed':
      return { orderCalled: 'Called', orderStatus: { $ne: 'Cancelled' } };
    case 'pending':
      return {
        orderCalled: { $ne: 'Called' },
        orderStatus: { $nin: ['Cancelled', 'Fulfilled', 'Returned', 'Delivered'] },
      };
    case 'fulfilled':
      return { orderStatus: 'Fulfilled' };
    case 'cancelled':
      return { orderType: 'Cancelled' };
    case 'returned':
      return { orderType: 'Returned' };
    case 'cod':
      return { orderType: 'COD', orderStatus: { $ne: 'Cancelled' } };
    case 'prepaid':
      return { orderType: 'Prepaid', orderStatus: { $ne: 'Cancelled' } };
    case 'arriving':
      return { orderStatus: 'Arriving' };
    default:
      return {};
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || 50);
  const page = parseInt(searchParams.get('page') || 1);
  const search = searchParams.get('search') || '';
  const filter = searchParams.get('filter') || 'all';
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  try {
    await connectDb();

    // Base match conditions (search + date range)
    let baseMatch = {};

    // Search
    if (search) {
      const kw = search.toLowerCase().trim();
      baseMatch.$or = [
        { orderNumber: { $regex: kw, $options: 'i' } },
        { 'shippingInfo.firstname': { $regex: kw, $options: 'i' } },
        { 'shippingInfo.lastname': { $regex: kw, $options: 'i' } },
        { 'shippingInfo.email': { $regex: kw, $options: 'i' } },
        { 'shippingInfo.phone': parseInt(kw) || null },
      ];
    }

    // Date range
    if (startDate && endDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      baseMatch.createdAt = { $gte: start, $lte: end };
    }

    // Apply the selected filter to the main query (for orders list)
    const filterQuery = buildFilterQuery(filter);
    const mainMatch = { ...baseMatch, ...filterQuery };

    // Aggregation pipeline
    const skip = (page - 1) * limit;

    const aggregation = await OrderModel.aggregate([
      { $match: baseMatch }, // base match first (date + search)
      {
        $facet: {
          // Paginated orders with product population
          orders: [
            { $match: filterQuery }, // apply the selected filter
            { $sort: { createdAt: -1 } },
            { $skip: skip },
            { $limit: limit },
            {
              $lookup: {
                from: 'products',
                localField: 'orderItems.product',
                foreignField: '_id',
                as: 'populatedProducts',
              },
            },
            // Reconstruct orderItems with populated product
            {
              $addFields: {
                orderItems: {
                  $map: {
                    input: '$orderItems',
                    as: 'item',
                    in: {
                      product: {
                        $arrayElemAt: [
                          {
                            $filter: {
                              input: '$populatedProducts',
                              cond: { $eq: ['$$this._id', '$$item.product'] },
                            },
                          },
                          0,
                        ],
                      },
                      quantity: '$$item.quantity',
                      _id: '$$item._id',
                    },
                  },
                },
              },
            },
            { $project: { populatedProducts: 0 } },
          ],
          // Total count for pagination (with selected filter)
          totalCount: [
            { $match: filterQuery },
            { $count: 'count' },
          ],
          // Stats for each filter type (count + total finalAmount)
          confirmed: [
            { $match: { orderCalled: 'Called', orderStatus: { $ne: 'Cancelled' } } },
            { $group: { _id: null, count: { $sum: 1 }, total: { $sum: '$finalAmount' } } },
          ],
          pending: [
            {
              $match: {
                orderCalled: { $ne: 'Called' },
                orderStatus: { $nin: ['Cancelled', 'Fulfilled', 'Returned', 'Delivered'] },
              },
            },
            { $group: { _id: null, count: { $sum: 1 }, total: { $sum: '$finalAmount' } } },
          ],
          fulfilled: [
            { $match: { orderStatus: 'Fulfilled' } },
            { $group: { _id: null, count: { $sum: 1 }, total: { $sum: '$finalAmount' } } },
          ],
          cancelled: [
            { $match: { orderType: 'Cancelled' } },
            { $group: { _id: null, count: { $sum: 1 }, total: { $sum: '$finalAmount' } } },
          ],
          returned: [
            { $match: { orderType: 'Returned' } },
            { $group: { _id: null, count: { $sum: 1 }, total: { $sum: '$finalAmount' } } },
          ],
          cod: [
            { $match: { orderType: 'COD', orderStatus: { $ne: 'Cancelled' } } },
            { $group: { _id: null, count: { $sum: 1 }, total: { $sum: '$finalAmount' } } },
          ],
          prepaid: [
            { $match: { orderType: 'Prepaid', orderStatus: { $ne: 'Cancelled' } } },
            { $group: { _id: null, count: { $sum: 1 }, total: { $sum: '$finalAmount' } } },
          ],
          arriving: [
            { $match: { orderStatus: 'Arriving' } },
            { $group: { _id: null, count: { $sum: 1 }, total: { $sum: '$finalAmount' } } },
          ],
        },
      },
    ]);

    const result = aggregation[0] || {};
    const orders = result.orders || [];
    const totalCount = result.totalCount[0]?.count || 0;
    const totalPages = Math.ceil(totalCount / limit);

    // Format filter stats
    const filters = {};
    const filterKeys = ['confirmed', 'pending', 'fulfilled', 'cancelled', 'returned', 'cod', 'prepaid', 'arriving'];
    filterKeys.forEach(key => {
      const data = result[key]?.[0];
      filters[key] = {
        count: data?.count || 0,
        total: data?.total || 0,
      };
    });

    return Response.json({
      orders,
      currentPage: page,
      totalPages,
      totalOrders: totalCount,
      filters,
    });
  } catch (error) {
    console.error(error);
    return Response.json({ status: 500, message: 'Server Error' }, { status: 500 });
  }
}