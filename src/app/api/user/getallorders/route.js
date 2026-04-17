import connectDb from "../../../../../config/connectDb";
import OrderModel from "../../../../../models/orderModel";

const PREPAID_TYPES = ['prepaid', 'payu', 'online', 'pre-paid'];

const CANCELLED_ORDER_MATCH = {
  $or: [
    { _orderTypeNormalized: 'cancelled' },
    { _orderStatusNormalized: 'cancelled' },
  ],
};

const RETURNED_ORDER_MATCH = {
  $or: [
    { _orderTypeNormalized: 'returned' },
    { _orderStatusNormalized: 'returned' },
  ],
};

const EXCLUDE_CANCELLED_RETURNED = {
  $nor: [CANCELLED_ORDER_MATCH, RETURNED_ORDER_MATCH],
};

function buildFilterQuery(filter) {
  switch (filter) {
    case 'confirmed':
      return {
        $and: [
          { _orderCalledNormalized: 'called' },
          EXCLUDE_CANCELLED_RETURNED,
        ],
      };
    case 'pending':
      return {
        $and: [
          { _orderCalledNormalized: { $ne: 'called' } },
          { _orderStatusNormalized: { $nin: ['fulfilled', 'delivered'] } },
          EXCLUDE_CANCELLED_RETURNED,
        ],
      };
    case 'fulfilled':
      return {
        $and: [
          { _orderStatusNormalized: { $in: ['fulfilled', 'delivered'] } },
          EXCLUDE_CANCELLED_RETURNED,
        ],
      };
    case 'cancelled':
      return CANCELLED_ORDER_MATCH;
    case 'returned':
      return RETURNED_ORDER_MATCH;
    case 'cod':
      return {
        $and: [
          { _orderTypeNormalized: 'cod' },
          EXCLUDE_CANCELLED_RETURNED,
        ],
      };
    case 'prepaid':
      return {
        $and: [
          { _orderTypeNormalized: { $in: PREPAID_TYPES } },
          EXCLUDE_CANCELLED_RETURNED,
        ],
      };
    case 'arriving':
      return {
        $and: [
          { _orderStatusNormalized: { $regex: /^arriving/i } },
          EXCLUDE_CANCELLED_RETURNED,
        ],
      };
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

    // Aggregation pipeline
    const skip = (page - 1) * limit;
    const confirmedFilter = buildFilterQuery('confirmed');
    const pendingFilter = buildFilterQuery('pending');
    const fulfilledFilter = buildFilterQuery('fulfilled');
    const cancelledFilter = buildFilterQuery('cancelled');
    const returnedFilter = buildFilterQuery('returned');
    const codFilter = buildFilterQuery('cod');
    const prepaidFilter = buildFilterQuery('prepaid');
    const arrivingFilter = buildFilterQuery('arriving');

    const aggregation = await OrderModel.aggregate([
      { $match: baseMatch }, // base match first (date + search)
      {
        $addFields: {
          _orderTypeNormalized: {
            $toLower: { $trim: { input: { $ifNull: ['$orderType', ''] } } },
          },
          _orderStatusNormalized: {
            $toLower: { $trim: { input: { $ifNull: ['$orderStatus', ''] } } },
          },
          _orderCalledNormalized: {
            $toLower: { $trim: { input: { $ifNull: ['$orderCalled', ''] } } },
          },
        },
      },
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
                      isGift: '$$item.isGift',
                      giftWrap: '$$item.giftWrap',
                      giftWrapCharge: '$$item.giftWrapCharge',
                      giftMessage: '$$item.giftMessage',
                      _id: '$$item._id',
                    },
                  },
                },
              },
            },
            {
              $project: {
                populatedProducts: 0,
                _orderTypeNormalized: 0,
                _orderStatusNormalized: 0,
                _orderCalledNormalized: 0,
              },
            },
          ],
          // Total count for pagination (with selected filter)
          totalCount: [
            { $match: filterQuery },
            { $count: 'count' },
          ],
          // Stats for each filter type (count + total finalAmount)
          confirmed: [
            { $match: confirmedFilter },
            { $group: { _id: null, count: { $sum: 1 }, total: { $sum: '$finalAmount' } } },
          ],
          pending: [
            { $match: pendingFilter },
            { $group: { _id: null, count: { $sum: 1 }, total: { $sum: '$finalAmount' } } },
          ],
          fulfilled: [
            { $match: fulfilledFilter },
            { $group: { _id: null, count: { $sum: 1 }, total: { $sum: '$finalAmount' } } },
          ],
          cancelled: [
            { $match: cancelledFilter },
            { $group: { _id: null, count: { $sum: 1 }, total: { $sum: '$finalAmount' } } },
          ],
          returned: [
            { $match: returnedFilter },
            { $group: { _id: null, count: { $sum: 1 }, total: { $sum: '$finalAmount' } } },
          ],
          cod: [
            { $match: codFilter },
            { $group: { _id: null, count: { $sum: 1 }, total: { $sum: '$finalAmount' } } },
          ],
          prepaid: [
            { $match: prepaidFilter },
            { $group: { _id: null, count: { $sum: 1 }, total: { $sum: '$finalAmount' } } },
          ],
          arriving: [
            { $match: arrivingFilter },
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
