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
  try {
    const body = await req.json();
    const { mobile, password } = body;



    // Input validations
    if (!mobile || !password) {
      return NextResponse.json(
        { 
          success: false,
          message: "Mobile and password are required" 
        },
        { status: 400 }
      );
    }

    // Mobile validation
    const mobileRegex = /^[6-9]\d{9}$/;
    if (typeof mobile !== 'string' || !mobileRegex.test(mobile)) {
      return NextResponse.json(
        { 
          success: false,
          message: "Invalid mobile number format" 
        },
        { status: 400 }
      );
    }

    // Password validation
    if (typeof password !== 'string' || password.length < 1) {
      return NextResponse.json(
        { 
          success: false,
          message: "Password is required" 
        },
        { status: 400 }
      );
    }

    await connectDb();

    // Find the user
    const findUser = await UserModel.findOne({ mobile });
    
    if (!findUser) {
      return NextResponse.json(
        { 
          success: false,
          message: "User not found" 
        },
        { status: 404 }
      );
    }

    // Check if user is active (if you have such field)
    if (findUser.role && findUser.role !== "admin") {
      return NextResponse.json(
        { 
          success: false,
          message: "Account is not Admin. Please contact support." 
        },
        { status: 403 }
      );
    }

    // Check if password exists in DB
    if (!findUser.password) {
      return NextResponse.json(
        { 
          success: false,
          message: "Password not set for this user. Please reset your password." 
        },
        { status: 400 }
      );
    }

    // Validate password
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

    // Generate refresh token
    const adminRefreshToken = await generateadminRefreshToken(findUser._id);

    // Update user with refresh token
    const updatedUser = await UserModel.findByIdAndUpdate(
      findUser._id,
      { 
        adminRefreshToken,
        lastLogin: new Date() // Track last login time
      },
      { new: true }
    );

    // Prepare user data for response
    const userData = {
      _id: updatedUser._id,
      firstname: updatedUser.firstname,
      lastname: updatedUser.lastname,
      email: updatedUser.email,
      mobile: updatedUser.mobile,
      image: updatedUser.image,
      role: updatedUser.role,
      token: generateToken(updatedUser._id),
    };

    // Create response
    const response = NextResponse.json({
      success: true,
      message: "Login successful",
      user: userData,
    });

    // Set refresh token cookie
    response.cookies.set("adminRefreshToken", adminRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production", // Secure in production
      maxAge: Number.isFinite(ADMIN_REFRESH_COOKIE_MAX_AGE_SECONDS)
        ? ADMIN_REFRESH_COOKIE_MAX_AGE_SECONDS
        : DEFAULT_REFRESH_COOKIE_MAX_AGE_SECONDS,
      path: "/",
      sameSite: "strict",
    });

    // Set additional security headers
    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set("X-Frame-Options", "DENY");

    return response;

  } catch (error) {
    console.error("Login error:", error);

    // Handle specific errors
    if (error.name === 'ValidationError') {
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
