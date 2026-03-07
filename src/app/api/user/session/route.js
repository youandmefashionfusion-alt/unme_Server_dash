// app/api/user/session/route.js  // ✅ Path should match your authSlice fetch URL
import { NextResponse } from "next/server";
import connectDb from "../../../../../config/connectDb";  // ✅ Adjust path based on your structure
import UserModel from "../../../../../models/userModel";
import jwt from 'jsonwebtoken';

export async function GET(req) {
  try {
    await connectDb();

    // ✅ Try multiple methods to get the token
    // 1. From cookies
    let adminRefreshToken = req.cookies.get('adminRefreshToken')?.value;
    
    // 2. From Authorization header (for client-side requests)
    if (!adminRefreshToken) {
      const authHeader = req.headers.get('authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        adminRefreshToken = authHeader.substring(7);
      }
    }

    if (!adminRefreshToken) {
      return NextResponse.json({ 
        user: null,
        isAuthenticated: false 
      }, { status: 401 });  // ✅ Added proper status code
    }

    // Verify the refresh token
    let decoded;
    try {
      decoded = jwt.verify(adminRefreshToken, process.env.JWT_SECRET);
    } catch (error) {
      console.error("Token verification failed:", error.message);
      
      const response = NextResponse.json({ 
        user: null,
        isAuthenticated: false,
        error: "Invalid or expired token"
      }, { status: 401 });
      
      // Only delete cookie if it exists
      if (req.cookies.get('adminRefreshToken')) {
        response.cookies.delete('adminRefreshToken');
      }
      
      return response;
    }

    // ✅ Check if decoded has required fields
    if (!decoded.id && !decoded._id) {
      console.error("Token missing user ID");
      return NextResponse.json({ 
        user: null,
        isAuthenticated: false,
        error: "Invalid token format"
      }, { status: 401 });
    }

    const userId = decoded.id || decoded._id;

    // Find user by ID from the token
    const user = await UserModel.findById(userId)
      .select('-password')  // ✅ Removed adminRefreshToken from exclusion for comparison
      .lean();

    if (!user) {
      console.error("User not found for ID:", userId);
      
      const response = NextResponse.json({ 
        user: null,
        isAuthenticated: false,
        error: "User not found"
      }, { status: 404 });
      
      if (req.cookies.get('adminRefreshToken')) {
        response.cookies.delete('adminRefreshToken');
      }
      
      return response;
    }

    // ✅ Check if user is admin (if role check is needed)
    if (user.role !== 'admin') {
      return NextResponse.json({ 
        user: null,
        isAuthenticated: false,
        error: "Unauthorized access"
      }, { status: 403 });
    }

    // ✅ Optional: Verify token matches database (only if you store tokens)
    // Comment this out if you don't store refresh tokens in the database
    if (user.adminRefreshToken && user.adminRefreshToken !== adminRefreshToken) {
      console.error("Token mismatch");
      
      const response = NextResponse.json({ 
        user: null,
        isAuthenticated: false,
        error: "Token mismatch"
      }, { status: 401 });
      
      if (req.cookies.get('adminRefreshToken')) {
        response.cookies.delete('adminRefreshToken');
      }
      
      return response;
    }

    // ✅ Generate new access token for the session
    const newAccessToken = jwt.sign(
      { 
        id: user._id,
        role: user.role,
        email: user.email 
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }  // Match your refresh token expiry
    );

    // Return user session data
    return NextResponse.json({
      user: {
        _id: user._id,
        firstname: user.firstname,
        lastname: user.lastname,
        email: user.email,
        mobile: user.mobile,
        image: user.image,
        role: user.role,
        token: newAccessToken,  // ✅ Include new token
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      isAuthenticated: true,
      expires: decoded.exp,
    }, { status: 200 });

  } catch (error) {
    console.error("Session API error:", error);
    return NextResponse.json(
      { 
        user: null,
        isAuthenticated: false,
        error: "Internal server error",
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    );
  }
}