import jwt from "jsonwebtoken";
import connectDb from "../../../../../config/connectDb";
import OrderModel from "../../../../../models/orderModel";
import UserModel from "../../../../../models/userModel";

const ALLOWED_DELETE_ADMIN = {
  mobile: "9719250693",
  firstname: "ujjawal",
  email: "ujjawal@codexae.com",
};

const normalize = (value) => String(value || "").trim().toLowerCase();

const isAllowedDeleteAdmin = (user = {}) => {
  return (
    normalize(user?.mobile) === normalize(ALLOWED_DELETE_ADMIN.mobile) &&
    normalize(user?.firstname) === normalize(ALLOWED_DELETE_ADMIN.firstname) &&
    normalize(user?.email) === normalize(ALLOWED_DELETE_ADMIN.email) &&
    normalize(user?.role) === "admin"
  );
};

export async function DELETE(request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const token = searchParams.get("token");

  if (!id) {
    return Response.json(
      { success: false, message: "Order id is required" },
      { status: 400 }
    );
  }

  if (!token) {
    return Response.json(
      { success: false, message: "Authorization token is required" },
      { status: 401 }
    );
  }

  try {
    await connectDb();

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const requestingUser = await UserModel.findById(decoded?.id).lean();

    if (!requestingUser) {
      return Response.json(
        { success: false, message: "User not found" },
        { status: 404 }
      );
    }

    if (!isAllowedDeleteAdmin(requestingUser)) {
      return Response.json(
        { success: false, message: "Not authorized to delete orders" },
        { status: 403 }
      );
    }

    const deletedOrder = await OrderModel.findByIdAndDelete(id);
    if (!deletedOrder) {
      return Response.json(
        { success: false, message: "Order not found" },
        { status: 404 }
      );
    }

    return Response.json(
      { success: true, message: "Order deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    return Response.json(
      { success: false, message: "Server Error" },
      { status: 500 }
    );
  }
}

