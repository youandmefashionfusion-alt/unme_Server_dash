import connectDb from "../../../../../config/connectDb";
import OrderModel from "../../../../../models/orderModel";
import sendEmail from "../../../../../controller/emailController";
export async function PUT(req){
    const body=await req.json()
    const { name, ordernumber, email, orderId, arriving } = body;
  
    try {
        await connectDb()
      // Await the sendEmail function

        await sendEmail({
        to: email,
        subject: "Order Delivered: Your Order is Delivered!",
        text: "Order Delivered: Your Order is Delivered!",
        htmlContent: `
          <!DOCTYPE html>
          <html lang="en">
          <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Order Delivered</title>
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
                  <h2>Order Delivered: Your Order is Delivered!</h2>
                  <p>Dear ${name},</p>
  
                  <div class="order-details">
                      <p>Celebration time! Your <strong>Order #${ordernumber}</strong> has reached its destination...</p>
                      <p>Your patronage means the world to us...</p>
                      <p>https://g.page/r/Cb_ycM-UC2t5EBM/review</p>
                      <p>Once again, thank you for being an essential part of our journey...</p>
                  </div>
  
                  <p>Thank you for choosing <strong>unmejewels.com</strong> for your shopping needs!</p>
  
                  <div class="footer">
                      <p>&copy; 2025 UnMe Jewels. All rights reserved.</p>
                  </div>
              </div>
          </body>
          </html>
        `
      });
      
      // Update the order status
      
      const updatedOrder = await OrderModel.findByIdAndUpdate(orderId, { orderStatus: arriving?'Arriving':'Delivered' }, { new: true });

      return Response.json({ message: 'Notification sent successfully', updatedOrder });
    } catch (error) {
      console.error('Failed to send message:', error);
      return Response.json({status:500,error:error.message});
    }
  }