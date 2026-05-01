import connectDb from "../../../../../config/connectDb";
import authMiddleware from "../../../../../controller/authController";
import CouponModel from "../../../../../models/couponModel";

const ALLOWED_DISCOUNT_TYPES = new Set(["order", "buyX", "freeShip"]);
const ALLOWED_CUSTOMER_TYPES = new Set(["all", "specific"]);
const ALLOWED_STATUS = new Set(["active", "draft"]);

const toPositiveInteger = (value) => {
  const parsed = Number.parseInt(String(value ?? "").trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

const normalizeCouponPayload = (body = {}) => {
  const discounttype = String(body?.discounttype || "order").trim();
  const customertype = String(body?.customertype || "all").trim();
  const status = String(body?.status || "draft").trim();
  const discountRaw = String(body?.discount ?? "").trim();
  const minItemRaw = toPositiveInteger(body?.minItem);
  const cEmail = String(body?.cEmail || "").trim().toLowerCase();
  const expiry = body?.expiry ? new Date(body.expiry) : null;

  if (!String(body?.name || "").trim()) {
    throw new Error("Coupon name is required");
  }

  if (!ALLOWED_DISCOUNT_TYPES.has(discounttype)) {
    throw new Error("Invalid discount type");
  }

  if (!ALLOWED_CUSTOMER_TYPES.has(customertype)) {
    throw new Error("Invalid customer type");
  }

  if (!ALLOWED_STATUS.has(status)) {
    throw new Error("Invalid coupon status");
  }

  if (!expiry || Number.isNaN(expiry.getTime())) {
    throw new Error("Invalid expiry date");
  }

  if (customertype === "specific" && !cEmail) {
    throw new Error("Customer email is required for specific coupons");
  }

  if (discounttype === "buyX") {
    const freeItems = toPositiveInteger(discountRaw);
    if (!minItemRaw || !freeItems) {
      throw new Error("For Buy X Get Y, minItem and discount must be positive integers");
    }

    return {
      name: String(body.name).trim().toUpperCase(),
      discounttype,
      expiry,
      customertype,
      discount: String(freeItems),
      status,
      minItem: minItemRaw,
      cEmail: customertype === "specific" ? cEmail : "",
    };
  }

  if (discounttype === "order" && !discountRaw) {
    throw new Error("Discount value is required for order coupons");
  }

  return {
    name: String(body.name).trim().toUpperCase(),
    discounttype,
    expiry,
    customertype,
    discount: discounttype === "freeShip" ? "" : discountRaw,
    status,
    minItem: discounttype === "buyX" ? minItemRaw : 0,
    cEmail: customertype === "specific" ? cEmail : "",
  };
};
export async function POST(request) {
    const {searchParams}=new URL(request.url)
    const token=searchParams.get("token")
    const body=await request.json()
    try {
        await connectDb()
        await authMiddleware(token)
        const payload = normalizeCouponPayload(body);
        
                const data=await CouponModel.create(payload)
        
                if(data){
                    return Response.json(data)
                }
    } catch (error) {
        const status = error?.message?.toLowerCase?.().includes("invalid") || error?.message?.toLowerCase?.().includes("required")
          ? 400
          : 500;
        return Response.json({success:false,message:error?.message || "Failed to create coupon"},{status})   
    }
  }
