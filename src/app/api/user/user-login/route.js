import connectDb from "../../../../../config/connectDb";
import UserModel from "../../../../../models/userModel";
import { generateadminRefreshToken } from "../../../../../config/refreshtoken";
import { generateToken } from "../../../../../config/jwtToken";
import { NextResponse } from "next/server";

const DEFAULT_REFRESH_COOKIE_MAX_AGE_SECONDS = 365 * 24 * 60 * 60; // 365 days
const ADMIN_REFRESH_COOKIE_MAX_AGE_SECONDS = Number.parseInt(
  process.env.ADMIN_REFRESH_COOKIE_MAX_AGE_SECONDS || `${DEFAULT_REFRESH_COOKIE_MAX_AGE_SECONDS}`,
  10
);

export async function POST(req) {
  const body = await req.json();
  const { mobile, password } = body;

  try {
    await connectDb();

    // Find the user/admin
    const findAdmin = await UserModel.findOne({ mobile });
    if (!findAdmin || findAdmin.role !== "user") {
      return NextResponse.json(
        { message: "Not Authorized" },
        { status: 401 }
      );
    }

    // Check if password exists in DB
    if (!findAdmin.password) {
      return NextResponse.json(
        { message: "Password not set for this user" },
        { status: 400 }
      );
    }

    // Validate password
    const isMatch = await findAdmin.isPasswordMatched(password);
    if (!isMatch) {
      return NextResponse.json(
        { message: "Invalid Credentials" },
        { status: 401 }
      );
    }

    // Generate refresh token
    const adminRefreshToken = await generateadminRefreshToken(findAdmin._id);

    // Update user with refresh token
    await UserModel.findByIdAndUpdate(
      findAdmin._id,
      { adminRefreshToken },
      { new: true }
    );

    // Prepare response
    const response = NextResponse.json({
      _id: findAdmin._id,
      firstname: findAdmin.firstname,
      lastname: findAdmin.lastname,
      email: findAdmin.email,
      mobile: findAdmin.mobile,
      image: findAdmin.image,
      role: findAdmin.role,
      token: generateToken(findAdmin._id),
    });

    // Set refresh token cookie
    response.cookies.set("adminRefreshToken", adminRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: Number.isFinite(ADMIN_REFRESH_COOKIE_MAX_AGE_SECONDS)
        ? ADMIN_REFRESH_COOKIE_MAX_AGE_SECONDS
        : DEFAULT_REFRESH_COOKIE_MAX_AGE_SECONDS,
      path: "/",
      sameSite: "strict",
    });

    return response;

  } catch (error) {
    console.error("Error Login Admin:", error);
    return NextResponse.json(
      { message: "Internal Server Error" },
      { status: 500 }
    );
  }
}
