import connectDb from "../../../../../../config/connectDb";
import OrderModel from "../../../../../../models/orderModel";

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const parseDateInput = (value = "") => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value).trim());
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
};

const getISTStartOfDayUTC = ({ year, month, day }) =>
  new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0) - IST_OFFSET_MS);

const ACTIVE_ORDER_MATCH = {
  $nor: [
    { orderStatus: { $regex: /^\s*cancelled\s*$/i } },
    { orderStatus: { $regex: /^\s*returned\s*$/i } },
    { orderType: { $regex: /^\s*cancelled\s*$/i } },
    { orderType: { $regex: /^\s*returned\s*$/i } },
  ],
};

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get("startDate") || "";
  const endDate = searchParams.get("endDate") || "";

  const parsedStart = parseDateInput(startDate);
  const parsedEnd = parseDateInput(endDate);

  if (!parsedStart || !parsedEnd) {
    return Response.json(
      { success: false, message: "Invalid date format. Use YYYY-MM-DD" },
      { status: 400 }
    );
  }

  const start = getISTStartOfDayUTC(parsedStart);
  const end = new Date(getISTStartOfDayUTC(parsedEnd).getTime() + DAY_MS - 1);

  if (start > end) {
    return Response.json(
      { success: false, message: "Start date cannot be later than end date" },
      { status: 400 }
    );
  }

  await connectDb();

  const data = await OrderModel.aggregate([
    {
      $match: {
        createdAt: {
          $gte: start,
          $lte: end,
        },
        ...ACTIVE_ORDER_MATCH,
      },
    },
    {
      $group: {
        _id: null,
        totalIncome: { $sum: "$finalAmount" },
        totalCount: { $sum: 1 },
        totalItems: {
          $sum: {
            $sum: {
              $map: {
                input: { $ifNull: ["$orderItems", []] },
                as: "item",
                in: {
                  $convert: {
                    input: "$$item.quantity",
                    to: "double",
                    onError: 0,
                    onNull: 0,
                  },
                },
              },
            },
          },
        },
        items: { $push: "$orderItems" },
      },
    },
    {
      $project: {
        _id: 0,
        totalIncome: 1,
        totalCount: 1,
        itemCount: "$totalItems",
        items: 1,
      },
    },
  ]);

  return Response.json(data);
}
  
