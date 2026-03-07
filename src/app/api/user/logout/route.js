// app/api/web/logout/route.js
import { NextResponse } from "next/server";
import connectDb from "../../../../../config/connectDb";
import UserModel from "../../../../../models/userModel";
import jwt from 'jsonwebtoken';

// Helper function to verify token and get user ID
async function verifyToken(req) {
  try {
    // Get token from either cookie or Authorization header
    let token;
    
    // Check cookie first
    const adminRefreshToken = req.cookies.get('adminRefreshToken')?.value;
    if (adminRefreshToken) {
      token = adminRefreshToken;
    }
    
    // If no cookie, check Authorization header
    if (!token) {
      const authHeader = req.headers.get('authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }

    if (!token) {
      return { error: "No token provided", status: 401 };
    }

    // Verify the token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Verify the token exists in database (for refresh tokens)
    if (adminRefreshToken) {
      const dbUser = await UserModel.findById(decoded.id).select('adminRefreshToken');
      if (!dbUser || dbUser.adminRefreshToken !== adminRefreshToken) {
        return { error: "Invalid token", status: 401 };
      }
    }

    return { userId: decoded.id };
  } catch (error) {
    console.error("Token verification failed:", error);
    return { error: "Invalid token", status: 401 };
  }
}

export async function POST(req) {
  try {
    await connectDb();

    // Verify token and get user ID
    const tokenResult = await verifyToken(req);
    
    let userId = null;
    if (tokenResult.userId) {
      userId = tokenResult.userId;
      
      // Clear the refresh token from database for the authenticated user
      await UserModel.findByIdAndUpdate(
        userId,
        { $unset: { adminRefreshToken: 1 } }, // Remove adminRefreshToken field
        { new: true }
      );
    }

    // Create response
    const response = NextResponse.json({
      success: true,
      message: "Logged out successfully"
    });

    // Clear all auth-related cookies
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0 // Expire immediately
    };

    // Clear adminRefreshToken cookie
    response.cookies.set('adminRefreshToken', '', cookieOptions);

    // Clear any potential NextAuth cookies (if they exist)
    response.cookies.set('next-auth.session-token', '', cookieOptions);
    response.cookies.set('next-auth.csrf-token', '', cookieOptions);
    response.cookies.set('__Secure-next-auth.session-token', '', {
      ...cookieOptions,
      secure: true
    });

    // Clear any other potential auth cookies
    response.cookies.set('auth-token', '', cookieOptions);
    response.cookies.set('token', '', cookieOptions);

    // Additional security headers
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'DENY');

    return response;

  } catch (error) {
    console.error("Logout API error:", error);
    
    // Even if there's an error, try to clear cookies
    const response = NextResponse.json(
      { 
        success: false,
        error: "Failed to logout properly" 
      },
      { status: 500 }
    );

    // Clear cookies on error as well
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0
    };

    response.cookies.set('adminRefreshToken', '', cookieOptions);
    response.cookies.set('next-auth.session-token', '', cookieOptions);

    return response;
  }
}

export async function GET() {
  return NextResponse.json(
    { error: "Method not allowed" },
    { status: 405 }
  );
}