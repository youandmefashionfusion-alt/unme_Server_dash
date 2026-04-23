import OrderModel from "../../../../../models/orderModel"; // Adjust the import path as needed
import "../../../../../models/productModel";
import connectDb from "../../../../../config/connectDb";
export const config = {
  maxDuration: 10,
};
export async function GET(req) {
  await connectDb();

  try {
    // Use req.nextUrl to get query parameters
    const { searchParams } = new URL(req.url);
    const email = searchParams.get("email"); // Get the 'email' query parameter

    // Check if email is provided
    if (!email) {
      return new Response(
        JSON.stringify({ success: false, message: "Email is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Find orders where the email matches the user's email in shippingInfo
    const orders = await OrderModel.find({ "shippingInfo.email": email })
      .populate("orderItems.product"); // Populate product data in orderItems (if needed)

    // Check if orders are found
    if (!orders || orders.length === 0) {
      return new Response(
        JSON.stringify({ success: false, message: "No orders found for this email" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // Return the orders
    return new Response(
      JSON.stringify({ success: true, orders }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error(error);
    return new Response(
      JSON.stringify({ success: false, message: "Server Error", error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
