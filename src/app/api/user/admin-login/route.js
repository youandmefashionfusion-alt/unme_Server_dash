import connectDb from "../../../../../config/connectDb";
import UserModel from "../../../../../models/userModel";
import { generateadminRefreshToken } from "../../../../../config/refreshtoken";
import { generateToken } from "../../../../../config/jwtToken";
import { NextResponse } from "next/server";

const DEFAULT_REMEMBER_COOKIE_MAX_AGE_SECONDS = 365 * 24 * 60 * 60; // 365 days
const ADMIN_REMEMBER_COOKIE_MAX_AGE_SECONDS = Number.parseInt(
  process.env.ADMIN_REMEMBER_COOKIE_MAX_AGE_SECONDS ||
    `${DEFAULT_REMEMBER_COOKIE_MAX_AGE_SECONDS}`,
  10
);
const ADMIN_PERSISTENT_REFRESH_EXPIRES_IN =
  process.env.ADMIN_PERSISTENT_REFRESH_EXPIRES_IN || "365d";
const ADMIN_SESSION_REFRESH_EXPIRES_IN =
  process.env.ADMIN_SESSION_REFRESH_EXPIRES_IN || "7d";
const ADMIN_PERSISTENT_ACCESS_EXPIRES_IN =
  process.env.ADMIN_PERSISTENT_ACCESS_EXPIRES_IN ||
  process.env.JWT_ACCESS_EXPIRES_IN ||
  "365d";
const ADMIN_SESSION_ACCESS_EXPIRES_IN =
  process.env.ADMIN_SESSION_ACCESS_EXPIRES_IN || "7d";
const MOBILE_REGEX = /^[6-9]\d{9}$/;

const normalizeMobile = (value) =>
  String(value || "").replace(/\D/g, "").slice(-10);
const parseRememberMe = (value) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "true" || normalized === "1" || normalized === "yes";
  }
  return false;
};

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const normalizedMobile = normalizeMobile(body?.mobile);
    const password = String(body?.password || "");
    const rememberMe = parseRememberMe(body?.rememberMe);

    if (!normalizedMobile || !password) {
      return NextResponse.json(
        {
          success: false,
          message: "Mobile and password are required"
        },
        { status: 400 }
      );
    }

    if (!MOBILE_REGEX.test(normalizedMobile)) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid mobile number format"
        },
        { status: 400 }
      );
    }

    await connectDb();

    const mobileCandidates = [
      normalizedMobile,
      `+91${normalizedMobile}`,
      `91${normalizedMobile}`,
    ];
    const findUser = await UserModel.findOne({ mobile: { $in: mobileCandidates } });

    if (!findUser) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid mobile number or password"
        },
        { status: 401 }
      );
    }

    const normalizedRole = String(findUser?.role || "").trim().toLowerCase();
    if (normalizedRole !== "admin") {
      return NextResponse.json(
        {
          success: false,
          message: "Account is not Admin. Please contact support."
        },
        { status: 403 }
      );
    }

    if (findUser?.isBlocked) {
      return NextResponse.json(
        {
          success: false,
          message: "Your account is blocked. Please contact support."
        },
        { status: 403 }
      );
    }

    if (!findUser.password) {
      return NextResponse.json(
        {
          success: false,
          message: "Password not set for this user. Please reset your password."
        },
        { status: 400 }
      );
    }

    const isMatch = await findUser.isPasswordMatched(password);
    if (!isMatch) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid mobile number or password"
        },
        { status: 401 }
      );
    }

    const refreshTokenExpiresIn = rememberMe
      ? ADMIN_PERSISTENT_REFRESH_EXPIRES_IN
      : ADMIN_SESSION_REFRESH_EXPIRES_IN;
    const accessTokenExpiresIn = rememberMe
      ? ADMIN_PERSISTENT_ACCESS_EXPIRES_IN
      : ADMIN_SESSION_ACCESS_EXPIRES_IN;

    const adminRefreshToken = await generateadminRefreshToken(
      findUser._id,
      refreshTokenExpiresIn
    );

    const updatedUser = await UserModel.findByIdAndUpdate(
      findUser._id,
      {
        adminRefreshToken,
        lastLogin: new Date()
      },
      { new: true }
    );

    if (!updatedUser) {
      return NextResponse.json(
        {
          success: false,
          message: "Unable to complete login right now"
        },
        { status: 500 }
      );
    }

    const userData = {
      _id: updatedUser._id,
      firstname: updatedUser.firstname,
      lastname: updatedUser.lastname,
      email: updatedUser.email,
      mobile: updatedUser.mobile,
      image: updatedUser.image,
      role: updatedUser.role,
      token: generateToken(updatedUser._id, accessTokenExpiresIn),
      rememberMe,
    };

    const response = NextResponse.json({
      success: true,
      message: "Login successful",
      user: userData,
    });

    response.cookies.set("adminRefreshToken", adminRefreshToken, {
      httpOnly: true, // Prevent JS access
      secure: process.env.NODE_ENV === "production",
      ...(rememberMe &&
        Number.isFinite(ADMIN_REMEMBER_COOKIE_MAX_AGE_SECONDS) && {
          maxAge: ADMIN_REMEMBER_COOKIE_MAX_AGE_SECONDS,
        }),
      path: "/",
      sameSite: "lax",
    });

    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set("X-Frame-Options", "DENY");

    return response;
  } catch (error) {
    const errorMessage = error?.message || "Internal server error";
    console.error("Admin login error:", errorMessage);

    if (
      /ECONNREFUSED|ENOTFOUND|querySrv|buffering timed out|server selection|Could not connect/i.test(
        errorMessage
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Database connection failed. Please verify MONGO_URL and Atlas network access.",
        },
        { status: 503 }
      );
    }

    if (error?.name === "ValidationError") {
      return NextResponse.json(
        {
          success: false,
          message: "Validation error occurred"
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        message: "Internal server error"
      },
      { status: 500 }
    );
  }
}
