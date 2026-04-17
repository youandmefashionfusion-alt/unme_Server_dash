import jwt from "jsonwebtoken";
import connectDb from "../../../../../config/connectDb";
import AdminOtpModel from "../../../../../models/adminOtpModel";
import UserModel from "../../../../../models/userModel";
import { isRestrictedAdmin, normalizeRestrictedValue } from "../../../../lib/restrictedAdmin";

const OTP_PURPOSE = "user-management";

const normalizeEmail = (value) => normalizeRestrictedValue(value);
const normalizeMobile = (value) => String(value || "").trim();
const normalizeName = (value) => String(value || "").trim();
const normalizeRole = (value) =>
  normalizeRestrictedValue(value) === "admin" ? "admin" : "user";

const resolveAuthorizedAdmin = async (token) => {
  if (!token) {
    return {
      success: false,
      status: 401,
      message: "Authorization token is required",
    };
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await UserModel.findById(decoded?.id).lean();

    if (!user) {
      return { success: false, status: 404, message: "User not found" };
    }

    if (!isRestrictedAdmin(user)) {
      return {
        success: false,
        status: 403,
        message: "Not authorized for this action",
      };
    }

    return { success: true, user };
  } catch (error) {
    return { success: false, status: 401, message: "Invalid or expired token" };
  }
};

const consumeOtpVerification = async ({ otpVerificationId, adminId }) => {
  const now = new Date();
  return AdminOtpModel.findOneAndUpdate(
    {
      _id: otpVerificationId,
      adminId,
      purpose: OTP_PURPOSE,
      verifiedAt: { $ne: null },
      consumedAt: null,
      expiresAt: { $gt: now },
    },
    { consumedAt: now },
    { new: true }
  );
};

export async function POST(req) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");

  let body = {};
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { success: false, message: "Invalid request body" },
      { status: 400 }
    );
  }

  const firstname = normalizeName(body?.firstname);
  const email = normalizeEmail(body?.email);
  const mobile = normalizeMobile(body?.mobile);
  const password = String(body?.password || "");
  const role = normalizeRole(body?.role);
  const otpVerificationId = String(body?.otpVerificationId || "").trim();

  if (!firstname || !email || !mobile || !password) {
    return Response.json(
      { success: false, message: "firstname, email, mobile and password are required" },
      { status: 400 }
    );
  }

  if (!otpVerificationId) {
    return Response.json(
      { success: false, message: "OTP verification is required" },
      { status: 400 }
    );
  }

  try {
    await connectDb();

    const authResult = await resolveAuthorizedAdmin(token);
    if (!authResult.success) {
      return Response.json(
        { success: false, message: authResult.message },
        { status: authResult.status }
      );
    }

    const existingUser = await UserModel.findOne({
      $or: [{ email }, { mobile }],
    }).lean();

    if (existingUser) {
      return Response.json(
        { success: false, message: "User with this email or mobile already exists" },
        { status: 409 }
      );
    }

    const otpVerified = await consumeOtpVerification({
      otpVerificationId,
      adminId: authResult.user._id,
    });

    if (!otpVerified) {
      return Response.json(
        { success: false, message: "OTP not verified or expired. Please verify again." },
        { status: 401 }
      );
    }

    const user = await UserModel.create({
      firstname,
      email,
      mobile,
      password,
      role,
    });

    return Response.json(
      {
        success: true,
        message: "User created successfully",
        user: {
          _id: user._id,
          firstname: user.firstname,
          email: user.email,
          mobile: user.mobile,
          role: user.role,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to create user:", error);
    return Response.json(
      { success: false, message: "Failed to create user" },
      { status: 500 }
    );
  }
}
