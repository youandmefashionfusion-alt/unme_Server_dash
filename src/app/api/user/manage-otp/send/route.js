import crypto from "crypto";
import jwt from "jsonwebtoken";
import connectDb from "../../../../../../config/connectDb";
import sendEmail from "../../../../../../controller/emailController";
import AdminOtpModel from "../../../../../../models/adminOtpModel";
import UserModel from "../../../../../../models/userModel";
import { isRestrictedAdmin, normalizeRestrictedValue } from "../../../../../lib/restrictedAdmin";

const OTP_PURPOSE = "user-management";
const OTP_EXPIRY_MINUTES = 10;

const generateOtp = (length = 6) => {
  const digits = "0123456789";
  let otp = "";
  for (let index = 0; index < length; index += 1) {
    otp += digits[Math.floor(Math.random() * digits.length)];
  }
  return otp;
};

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

  let payload = {};
  try {
    payload = await request.json();
  } catch {
    payload = {};
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
    const adminEmail = normalizeRestrictedValue(admin?.email);
    const requestedEmail = normalizeRestrictedValue(payload?.email || adminEmail);

    if (!requestedEmail || requestedEmail !== adminEmail) {
      return Response.json(
        { success: false, message: "OTP can only be sent to the authorized admin email" },
        { status: 400 }
      );
    }

    const otp = generateOtp();
    const otpHash = hashOtp(otp, admin._id);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    await AdminOtpModel.deleteMany({
      adminId: admin._id,
      purpose: OTP_PURPOSE,
      consumedAt: null,
    });

    await AdminOtpModel.create({
      adminId: admin._id,
      adminEmail,
      purpose: OTP_PURPOSE,
      otpHash,
      expiresAt,
      attempts: 0,
      verifiedAt: null,
      consumedAt: null,
    });

    const emailResult = await sendEmail({
      to: adminEmail,
      subject: "Your OTP for User Management",
      text: `Your OTP is ${otp}. It will expire in ${OTP_EXPIRY_MINUTES} minutes.`,
      htmlContent: `
        <div style="font-family: Arial, sans-serif; color: #1f2937;">
          <h2 style="margin: 0 0 12px;">User Management Verification</h2>
          <p style="margin: 0 0 12px;">Use this OTP to continue:</p>
          <p style="font-size: 28px; font-weight: 700; letter-spacing: 6px; margin: 0 0 12px;">${otp}</p>
          <p style="margin: 0;">This OTP expires in ${OTP_EXPIRY_MINUTES} minutes.</p>
        </div>
      `,
    });

    if (!emailResult?.success) {
      return Response.json(
        { success: false, message: "Failed to send OTP email" },
        { status: 500 }
      );
    }

    return Response.json(
      {
        success: true,
        message: "OTP sent successfully",
        expiresInSeconds: OTP_EXPIRY_MINUTES * 60,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error sending user-management OTP:", error.message);
    return Response.json(
      { success: false, message: "Unable to send OTP" },
      { status: 500 }
    );
  }
}
