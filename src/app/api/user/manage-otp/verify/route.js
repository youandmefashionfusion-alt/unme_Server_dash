import crypto from "crypto";
import jwt from "jsonwebtoken";
import connectDb from "../../../../../../config/connectDb";
import AdminOtpModel from "../../../../../../models/adminOtpModel";
import UserModel from "../../../../../../models/userModel";
import { isRestrictedAdmin } from "../../../../../lib/restrictedAdmin";

const OTP_PURPOSE = "user-management";
const MAX_ATTEMPTS = 5;

const hashOtp = (otp, adminId) =>
  crypto
    .createHash("sha256")
    .update(`${String(otp)}:${String(adminId)}:${process.env.JWT_SECRET || ""}`)
    .digest("hex");

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

export async function POST(request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const otp = String(body?.otp || "").trim();
  if (!/^\d{6}$/.test(otp)) {
    return Response.json(
      { success: false, message: "Please enter a valid 6-digit OTP" },
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

    const admin = authResult.user;
    const now = new Date();

    const otpDoc = await AdminOtpModel.findOne({
      adminId: admin._id,
      purpose: OTP_PURPOSE,
      consumedAt: null,
      expiresAt: { $gt: now },
    }).sort({ createdAt: -1 });

    if (!otpDoc) {
      return Response.json(
        { success: false, message: "OTP expired or not found. Please resend OTP." },
        { status: 400 }
      );
    }

    if ((otpDoc?.attempts || 0) >= MAX_ATTEMPTS) {
      await AdminOtpModel.findByIdAndUpdate(otpDoc._id, { consumedAt: now });
      return Response.json(
        { success: false, message: "Maximum attempts reached. Please resend OTP." },
        { status: 429 }
      );
    }

    const expectedHash = hashOtp(otp, admin._id);
    if (expectedHash !== otpDoc.otpHash) {
      const attempts = (otpDoc?.attempts || 0) + 1;
      await AdminOtpModel.findByIdAndUpdate(otpDoc._id, { attempts });
      return Response.json(
        { success: false, message: "Invalid OTP" },
        { status: 400 }
      );
    }

    const verifiedDoc = await AdminOtpModel.findByIdAndUpdate(
      otpDoc._id,
      { verifiedAt: now },
      { new: true }
    );

    return Response.json(
      {
        success: true,
        message: "OTP verified successfully",
        otpVerificationId: String(verifiedDoc?._id || ""),
        expiresAt: verifiedDoc?.expiresAt,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error verifying user-management OTP:", error.message);
    return Response.json(
      { success: false, message: "Unable to verify OTP" },
      { status: 500 }
    );
  }
}
