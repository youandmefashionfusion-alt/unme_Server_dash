import connectDb from "../../../../../config/connectDb";
import OrderModel from "../../../../../models/orderModel";
import sendEmail from "../../../../../controller/emailController";
export async function PUT(req){
    const body = await req.json();
    const {
      name,
      ordernumber,
      partner,
      link,
      email,
      orderId,
      trackingId,
      trackingLink,
      pickupDatetime,
      pickupId,
      pickupRequestedAt,
      sendEmailUpdate = true,
      updateOrderStatus = true,
    } = body;

    try {
      await connectDb();

      const existingOrder = await OrderModel.findById(orderId);
      if (!existingOrder) {
        return Response.json({ status: 404, error: "Order not found" }, { status: 404 });
      }

      const existingTracking = existingOrder.trackingInfo?.toObject?.() || {};
      const mergedTrackingInfo = {
        ...existingTracking,
        partner: partner ?? existingTracking.partner,
        link: link ?? existingTracking.link,
        trackingId: trackingId ?? existingTracking.trackingId,
        trackingLink: trackingLink ?? existingTracking.trackingLink,
        pickupDatetime: pickupDatetime ?? existingTracking.pickupDatetime,
        pickupId: pickupId ?? existingTracking.pickupId,
        pickupRequestedAt: pickupRequestedAt
          ? new Date(pickupRequestedAt)
          : existingTracking.pickupRequestedAt,
      };

      if (sendEmailUpdate && email && link && partner) {
        await sendEmail({
          to: email,
          subject: "Celebratory Update: Your Order is on Route!",
          text: "Celebratory Update: Your Order is on Route!",
          htmlContent: `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Order Tracking</title>
                <style>
                    body { font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0; }
                    .container { width: 100%; max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 20px; border-radius: 5px; box-shadow: 0 0 10px rgba(0, 0, 0, 0.1); }
                    h2 { color: #333333; }
                    p { color: #555555; }
                    .order-details { margin-top: 20px; }
                    .order-details p { margin: 5px 0; }
                    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #dddddd; font-size: 12px; color: #999999; text-align: center; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h2>Celebratory Update: Your Order is on Route!</h2>
                    <p>Dear ${name},</p>
    
                    <div class="order-details">
                        <p>Great news! Your eagerly awaited <strong>Order #${ordernumber}</strong> from unmejewels.com has embarked on its journey, swiftly dispatched via our esteemed courier partner, ${partner}.</p>
                        <p>Prepare for the excitement of its arrival by effortlessly tracking its progress through the link provided below.</p>
                        <p><strong>${link}</strong></p>
                    </div>
    
                    <p>Thank you for choosing <strong>unmejewels.com</strong> for your shopping needs!</p>
    
                    <div class="footer">
                        <p>&copy; 2025 UnMe Jewels. All rights reserved.</p>
                    </div>
                </div>
            </body>
            </html>
          `,
        });
      }

      const updateDoc = {
        trackingInfo: mergedTrackingInfo,
      };

      if (updateOrderStatus) {
        updateDoc.orderStatus = "Fulfilled";
      }

      const updatedOrder = await OrderModel.findByIdAndUpdate(orderId, updateDoc, {
        new: true,
      });

      return Response.json({
        message: sendEmailUpdate
          ? "Tracking email sent successfully"
          : "Tracking details updated successfully",
        updatedOrder,
      });
    } catch (error) {
      console.error("Failed to send/update tracking:", error);
      return Response.json({ status: 500, error: error.message }, { status: 500 });
    }
  }
