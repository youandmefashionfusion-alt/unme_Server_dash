import * as XLSX from "xlsx";
import connectDb from "../../../../../config/connectDb";
import authMiddleware from "../../../../../controller/authController";
import OrderModel from "../../../../../models/orderModel";

export const runtime = "nodejs";
export const config = {
  maxDuration: 60,
};

const DEFAULTS = {
  lastname: "-",
  emailDomain: "import.local",
  phone: 9999999999,
  address: "N/A",
  city: "N/A",
  state: "N/A",
  pincode: 111111,
};

const PREPAID_TYPES = new Set(["prepaid", "payu", "online", "pre-paid"]);
const normalizeHeader = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const normalizeValue = (value) => String(value || "").trim();
const aliasMap = {
  orderNumber: ["ordernumber", "orderid", "orderno", "order"],
  firstname: ["firstname", "first", "customername", "name"],
  lastname: ["lastname", "last"],
  email: ["email", "mail"],
  phone: ["mobile", "phone", "contact", "mobilenumber"],
  address: ["address", "fulladdress"],
  city: ["city"],
  state: ["state", "province"],
  pincode: ["pincode", "zipcode", "zip", "postalcode"],
  orderType: ["ordertype", "paymenttype", "paymentmode"],
  totalPrice: ["totalprice", "subtotal"],
  finalAmount: ["finalamount", "amount", "grandtotal", "total"],
  shippingCost: ["shippingcost", "shipping"],
  codCharge: ["codcharge", "cashondeliverycharge"],
  discount: ["discount"],
  orderStatus: ["orderstatus", "status"],
  orderCalled: ["ordercalled", "called"],
  createdAt: ["createdat", "date", "orderdate", "datetime"],
  razorpayOrderId: ["razorpayorderid", "rporderid"],
  razorpayPaymentId: ["razorpaypaymentid", "rppaymentid", "paymentid"],
};

const parseNumber = (value, fallback = 0) => {
  const normalized = normalizeValue(value)
    .replace(/,/g, "")
    .replace(/[^\d.-]/g, "");
  if (!normalized) return fallback;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parsePhone = (value) => {
  const digits = normalizeValue(value).replace(/\D/g, "");
  if (!digits) return DEFAULTS.phone;
  const lastTen = digits.length > 10 ? digits.slice(-10) : digits;
  const numeric = Number(lastTen);
  return Number.isFinite(numeric) ? numeric : DEFAULTS.phone;
};

const parsePincode = (value) => {
  const digits = normalizeValue(value).replace(/\D/g, "");
  if (!digits) return DEFAULTS.pincode;
  const numeric = Number(digits);
  return Number.isFinite(numeric) ? numeric : DEFAULTS.pincode;
};

const parseCreatedAt = (value) => {
  if (!value && value !== 0) return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) {
      const year = parsed.y;
      const month = (parsed.m || 1) - 1;
      const day = parsed.d || 1;
      const hour = parsed.H || 0;
      const minute = parsed.M || 0;
      const second = parsed.S || 0;
      const date = new Date(year, month, day, hour, minute, second);
      if (!Number.isNaN(date.getTime())) return date;
    }
  }

  const raw = normalizeValue(value);
  if (!raw) return null;

  const match = raw.match(
    /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})(?:,\s*|\s+)?(\d{1,2})?:?(\d{2})?\s*([ap]m)?$/i
  );
  if (match) {
    // Prefer DD/MM/YYYY for legacy dashboard export sheets.
    const day = Number(match[1]);
    const month = Number(match[2]);
    const rawYear = Number(match[3]);
    const year = rawYear < 100 ? 2000 + rawYear : rawYear;
    let hours = Number(match[4] || 0);
    const minutes = Number(match[5] || 0);
    const ampm = String(match[6] || "").toLowerCase();

    if (ampm === "pm" && hours < 12) hours += 12;
    if (ampm === "am" && hours === 12) hours = 0;

    const parsed = new Date(year, month - 1, day, hours, minutes, 0);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  const direct = new Date(raw);
  if (!Number.isNaN(direct.getTime())) return direct;

  return null;
};

const getMappedValue = (row, key) => {
  const aliases = aliasMap[key] || [];
  for (const alias of aliases) {
    const lookupKey = normalizeHeader(alias);
    if (Object.prototype.hasOwnProperty.call(row, lookupKey)) {
      const value = row[lookupKey];
      if (value !== undefined && value !== null && String(value).trim() !== "") {
        return value;
      }
    }
  }
  return "";
};

const getNormalizedRow = (rawRow) => {
  const normalizedRow = {};
  Object.entries(rawRow || {}).forEach(([key, value]) => {
    normalizedRow[normalizeHeader(key)] = value;
  });
  return normalizedRow;
};

const buildImportPayload = (rawRow, rowIndex) => {
  const row = getNormalizedRow(rawRow);

  const orderNumber = normalizeValue(getMappedValue(row, "orderNumber"));
  const firstname =
    normalizeValue(getMappedValue(row, "firstname")) || `Customer ${rowIndex + 1}`;
  const lastname = normalizeValue(getMappedValue(row, "lastname")) || DEFAULTS.lastname;
  const email =
    normalizeValue(getMappedValue(row, "email")) ||
    `${orderNumber || `legacy-${Date.now()}-${rowIndex}`}@${DEFAULTS.emailDomain}`;
  const phone = parsePhone(getMappedValue(row, "phone"));
  const address = normalizeValue(getMappedValue(row, "address")) || DEFAULTS.address;
  const city = normalizeValue(getMappedValue(row, "city")) || DEFAULTS.city;
  const state = normalizeValue(getMappedValue(row, "state")) || DEFAULTS.state;
  const pincode = parsePincode(getMappedValue(row, "pincode"));

  const orderTypeRaw = normalizeValue(getMappedValue(row, "orderType"));
  const normalizedOrderType = PREPAID_TYPES.has(orderTypeRaw.toLowerCase())
    ? "Prepaid"
    : orderTypeRaw.toLowerCase() === "cod"
      ? "COD"
      : orderTypeRaw
        ? orderTypeRaw
        : "COD";

  const finalAmount = parseNumber(getMappedValue(row, "finalAmount"), 0);
  const totalPrice = parseNumber(getMappedValue(row, "totalPrice"), finalAmount);
  const shippingCost = parseNumber(getMappedValue(row, "shippingCost"), 0);
  const codCharge = parseNumber(getMappedValue(row, "codCharge"), 0);
  const discount = parseNumber(getMappedValue(row, "discount"), 0);
  const orderStatus = normalizeValue(getMappedValue(row, "orderStatus")) || "Ordered";
  const orderCalled = normalizeValue(getMappedValue(row, "orderCalled")) || "Called";

  const importedReference = orderNumber || `IMPORTED-${Date.now()}-${rowIndex + 1}`;
  const providedRazorpayOrderId = normalizeValue(getMappedValue(row, "razorpayOrderId"));
  const providedRazorpayPaymentId = normalizeValue(getMappedValue(row, "razorpayPaymentId"));

  const paymentInfo =
    normalizedOrderType === "COD"
      ? {
          razorpayOrderId: "COD",
          razorpayPaymentId: "COD",
          paymentId: "COD",
        }
      : {
          razorpayOrderId: providedRazorpayOrderId || `IMPORT-RPO-${importedReference}`,
          razorpayPaymentId: providedRazorpayPaymentId || `IMPORT-RPP-${importedReference}`,
          paymentId: providedRazorpayPaymentId || `IMPORT-RPP-${importedReference}`,
        };

  const createdAt = parseCreatedAt(getMappedValue(row, "createdAt"));

  return {
    orderNumber,
    shippingInfo: {
      firstname,
      lastname,
      email,
      phone,
      address,
      city,
      state,
      pincode,
    },
    paymentInfo,
    orderItems: [],
    totalPrice,
    shippingCost,
    codCharge,
    orderType: normalizedOrderType,
    discount,
    giftWrapTotal: 0,
    finalAmount,
    orderStatus,
    orderCalled,
    orderComment: [
      {
        name: "System",
        message: "Imported from legacy order sheet",
        time: new Date(),
      },
    ],
    ...(createdAt ? { createdAt, updatedAt: createdAt, paidAt: createdAt } : {}),
  };
};

export async function POST(request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    const authResult = await authMiddleware(token);
    if (authResult instanceof Response) {
      return authResult;
    }
    await connectDb();

    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || typeof file === "string") {
      return Response.json(
        { success: false, error: "Please upload a valid Excel file" },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(Buffer.from(arrayBuffer), {
      type: "buffer",
      cellDates: true,
    });

    const sheetName = workbook.SheetNames?.[0];
    if (!sheetName) {
      return Response.json(
        { success: false, error: "Uploaded file does not contain any sheet" },
        { status: 400 }
      );
    }

    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false });

    if (!rows.length) {
      return Response.json(
        { success: false, error: "No rows found in uploaded file" },
        { status: 400 }
      );
    }

    const seenOrderNumbers = new Set();
    const fileOrderNumbers = rows
      .map((rawRow) => normalizeValue(getMappedValue(getNormalizedRow(rawRow), "orderNumber")))
      .filter(Boolean);
    const existingOrderDocs = fileOrderNumbers.length
      ? await OrderModel.find({ orderNumber: { $in: fileOrderNumbers } })
          .select("orderNumber")
          .lean()
      : [];
    const existingOrderNumbers = new Set(
      existingOrderDocs.map((item) => normalizeValue(item?.orderNumber))
    );

    const results = [];
    let createdCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    for (let index = 0; index < rows.length; index += 1) {
      const excelRowNumber = index + 2;
      const payload = buildImportPayload(rows[index], index);
      const normalizedOrderNumber = normalizeValue(payload.orderNumber);

      if (normalizedOrderNumber) {
        if (seenOrderNumbers.has(normalizedOrderNumber)) {
          skippedCount += 1;
          results.push({
            row: excelRowNumber,
            orderNumber: normalizedOrderNumber,
            status: "skipped",
            reason: "Duplicate order number in uploaded file",
          });
          continue;
        }
        if (existingOrderNumbers.has(normalizedOrderNumber)) {
          skippedCount += 1;
          results.push({
            row: excelRowNumber,
            orderNumber: normalizedOrderNumber,
            status: "skipped",
            reason: "Order already exists",
          });
          continue;
        }
      }

      if (!Number.isFinite(payload.finalAmount) || payload.finalAmount <= 0) {
        failedCount += 1;
        results.push({
          row: excelRowNumber,
          orderNumber: normalizedOrderNumber || "",
          status: "failed",
          reason: "Amount/finalAmount is missing or invalid",
        });
        continue;
      }

      try {
        await OrderModel.create(payload);
        if (normalizedOrderNumber) {
          seenOrderNumbers.add(normalizedOrderNumber);
          existingOrderNumbers.add(normalizedOrderNumber);
        }
        createdCount += 1;
        results.push({
          row: excelRowNumber,
          orderNumber: normalizedOrderNumber || "",
          status: "created",
        });
      } catch (error) {
        failedCount += 1;
        results.push({
          row: excelRowNumber,
          orderNumber: normalizedOrderNumber || "",
          status: "failed",
          reason: error?.message || "Failed to create order",
        });
      }
    }

    return Response.json(
      {
        success: true,
        message: "Import finished",
        totalRows: rows.length,
        createdCount,
        skippedCount,
        failedCount,
        results,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error importing orders:", error?.message || error);
    return Response.json(
      { success: false, error: error?.message || "Failed to import orders" },
      { status: 500 }
    );
  }
}
