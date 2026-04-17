import jwt from "jsonwebtoken";
import connectDb from "../../../../../config/connectDb";
import AdminOtpModel from "../../../../../models/adminOtpModel";
import UserModel from "../../../../../models/userModel";
import { isRestrictedAdmin } from "../../../../lib/restrictedAdmin";

const OTP_PURPOSE = "user-management";

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

export async function DELETE(req) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const token = searchParams.get("token");

  let body = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const otpVerificationId = String(body?.otpVerificationId || "").trim();

  if (!id) {
    return Response.json(
      { success: false, message: "User id is required" },
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

    if (String(authResult.user?._id) === String(id)) {
      return Response.json(
        { success: false, message: "You cannot delete your own account" },
        { status: 400 }
      );
    }

    const targetUser = await UserModel.findById(id).lean();
    if (!targetUser) {
      return Response.json(
        { success: false, message: "User not found" },
        { status: 404 }
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

    const deletedUser = await UserModel.findByIdAndDelete(id);
    if (!deletedUser) {
      return Response.json(
        { success: false, message: "User not found" },
        { status: 404 }
      );
    }

    return Response.json(
      { success: true, message: "User deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Failed to delete user:", error);
    return Response.json(
      { success: false, message: "Failed to delete user" },
      { status: 500 }
    );
  }
}
