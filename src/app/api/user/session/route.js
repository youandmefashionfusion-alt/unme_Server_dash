import { NextResponse } from "next/server";
import connectDb from "../../../../../config/connectDb";
import UserModel from "../../../../../models/userModel";
import jwt from "jsonwebtoken";

const ACCESS_TOKEN_EXPIRY = process.env.JWT_ACCESS_EXPIRES_IN || "365d";

export async function GET(req) {
  try {
    await connectDb();

    // Prefer refresh token from cookie; fall back to bearer token.
    let token = req.cookies.get("adminRefreshToken")?.value;
    let tokenSource = "cookie";

    if (!token) {
      const authHeader = req.headers.get("authorization");
      if (authHeader && authHeader.startsWith("Bearer ")) {
        token = authHeader.substring(7);
        tokenSource = "header";
      }
    }

    if (!token) {
      return NextResponse.json(
        {
          user: null,
          isAuthenticated: false,
        },
        { status: 401 }
      );
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      const response = NextResponse.json(
        {
          user: null,
          isAuthenticated: false,
          error: "Invalid or expired token",
        },
        { status: 401 }
      );

      if (req.cookies.get("adminRefreshToken")) {
        response.cookies.delete("adminRefreshToken");
      }

      return response;
    }

    const userId = decoded?.id || decoded?._id;

    if (!userId) {
      return NextResponse.json(
        {
          user: null,
          isAuthenticated: false,
          error: "Invalid token format",
        },
        { status: 401 }
      );
    }

    const user = await UserModel.findById(userId).select("-password").lean();

    if (!user) {
      const response = NextResponse.json(
        {
          user: null,
          isAuthenticated: false,
          error: "User not found",
        },
        { status: 401 }
      );

      if (req.cookies.get("adminRefreshToken")) {
        response.cookies.delete("adminRefreshToken");
      }

      return response;
    }

    if (user.role !== "admin") {
      return NextResponse.json(
        {
          user: null,
          isAuthenticated: false,
          error: "Unauthorized access",
        },
        { status: 403 }
      );
    }

    // Enforce DB token match only when cookie refresh token is used.
    if (
      tokenSource === "cookie" &&
      user.adminRefreshToken &&
      user.adminRefreshToken !== token
    ) {
      const response = NextResponse.json(
        {
          user: null,
          isAuthenticated: false,
          error: "Token mismatch",
        },
        { status: 401 }
      );

      if (req.cookies.get("adminRefreshToken")) {
        response.cookies.delete("adminRefreshToken");
      }

      return response;
    }

    const newAccessToken = jwt.sign(
      {
        id: user._id,
        role: user.role,
        email: user.email,
      },
      process.env.JWT_SECRET,
      { expiresIn: ACCESS_TOKEN_EXPIRY }
    );

    return NextResponse.json(
      {
        user: {
          _id: user._id,
          firstname: user.firstname,
          lastname: user.lastname,
          email: user.email,
          mobile: user.mobile,
          image: user.image,
          role: user.role,
          token: newAccessToken,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
        isAuthenticated: true,
        expires: decoded.exp,
      },
      { status: 200 }
    );
  } catch (error) {
    const errorMessage = error?.message || "Internal server error";
    console.error("Session API error:", errorMessage);

    if (
      /ECONNREFUSED|ENOTFOUND|querySrv|buffering timed out|server selection|Could not connect/i.test(
        errorMessage
      )
    ) {
      return NextResponse.json(
        {
          user: null,
          isAuthenticated: false,
          error: "Database connection failed. Please verify MONGO_URL and Atlas network access.",
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      {
        user: null,
        isAuthenticated: false,
        error: "Internal server error",
        details: process.env.NODE_ENV === "development" ? errorMessage : undefined,
      },
      { status: 500 }
    );
  }
}
