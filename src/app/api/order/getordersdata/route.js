import connectDb from "../../../../../config/connectDb";
import OrderModel from "../../../../../models/orderModel";

const IST_TIMEZONE = "Asia/Kolkata";
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const getISTDateParts = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: IST_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const map = parts.reduce((acc, part) => {
    if (part.type !== "literal") {
      acc[part.type] = part.value;
    }
    return acc;
  }, {});

  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
  };
};

const getISTStartOfDayUTC = ({ year, month, day }) =>
  new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0) - IST_OFFSET_MS);

const shiftRangeByDays = (range, days) => ({
  start: new Date(range.start.getTime() + days * DAY_MS),
  end: new Date(range.end.getTime() + days * DAY_MS),
});

const getTodayRangeIST = () => {
  const parts = getISTDateParts();
  const start = getISTStartOfDayUTC(parts);
  const end = new Date(start.getTime() + DAY_MS - 1);
  return { start, end };
};

const getWeekRangeIST = (todayRange) => {
  const istNow = new Date(Date.now() + IST_OFFSET_MS);
  const dayOfWeek = istNow.getUTCDay(); // Sunday=0 ... Saturday=6 (in IST-adjusted clock)
  const start = new Date(todayRange.start.getTime() - dayOfWeek * DAY_MS);
  const end = new Date(start.getTime() + 7 * DAY_MS - 1);
  return { start, end };
};

const getMonthRangeIST = () => {
  const { year, month } = getISTDateParts();
  const start = getISTStartOfDayUTC({ year, month, day: 1 });
  const nextMonthYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextMonthStart = getISTStartOfDayUTC({
    year: nextMonthYear,
    month: nextMonth,
    day: 1,
  });
  const end = new Date(nextMonthStart.getTime() - 1);
  return { start, end };
};

const getYearRangeIST = () => {
  const { year } = getISTDateParts();
  const start = getISTStartOfDayUTC({ year, month: 1, day: 1 });
  const nextYearStart = getISTStartOfDayUTC({ year: year + 1, month: 1, day: 1 });
  const end = new Date(nextYearStart.getTime() - 1);
  return { start, end };
};

const ACTIVE_ORDER_MATCH = {
  $nor: [
    { orderStatus: { $regex: /^\s*cancelled\s*$/i } },
    { orderStatus: { $regex: /^\s*returned\s*$/i } },
    { orderType: { $regex: /^\s*cancelled\s*$/i } },
    { orderType: { $regex: /^\s*returned\s*$/i } },
  ],
};

const aggregateMetrics = async (range, { amountKey = "totalIncome", countKey = "totalCount" } = {}) => {
  const [data] = await OrderModel.aggregate([
    {
      $match: {
        createdAt: {
          $gte: range.start,
          $lte: range.end,
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
        _id: 1,
        totalIncome: 1,
        totalCount: 1,
        totalItems: 1,
        items: 1,
      },
    },
  ]);

  if (!data) {
    return [];
  }

  return [
    {
      [amountKey]: data.totalIncome,
      [countKey]: data.totalCount,
      itemCount: data.totalItems,
      items: data.items,
    },
  ];
};

export async function GET() {
  try {
    await connectDb();

    const todayRange = getTodayRangeIST();
    const yesterdayRange = shiftRangeByDays(todayRange, -1);
    const weekRange = getWeekRangeIST(todayRange);
    const monthRange = getMonthRangeIST();
    const yearRange = getYearRangeIST();

    const [todaydata, yesterdaydata, weekdata, monthdata, yeardata] = await Promise.all([
      aggregateMetrics(todayRange, { amountKey: "totalIncome", countKey: "totalCount" }),
      aggregateMetrics(yesterdayRange, { amountKey: "totalIncome", countKey: "totalCount" }),
      aggregateMetrics(weekRange, { amountKey: "totalIncome", countKey: "totalCount" }),
      aggregateMetrics(monthRange, { amountKey: "amount", countKey: "count" }),
      aggregateMetrics(yearRange, { amountKey: "totalIncome", countKey: "totalCount" }),
    ]);

    return Response.json({
      monthdata,
      yeardata,
      todaydata,
      weekdata,
      yesterdaydata,
    });
  } catch (error) {
    console.error("Error fetching order metrics:", error);
    return Response.json(
      { success: false, message: "Failed to fetch order metrics" },
      { status: 500 }
    );
  }
}
  
