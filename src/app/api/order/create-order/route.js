import sendEmail from "../../../../../controller/emailController";
import ProductModel from "../../../../../models/productModel";
import OrderModel from "../../../../../models/orderModel";
import UserModel from "../../../../../models/userModel";
import connectDb from "../../../../../config/connectDb";
import {
  CHECKOUT_STANDARD_COD_CHARGE,
  CHECKOUT_STANDARD_GIFT_WRAP_CHARGE,
} from "../../../../lib/orderPricing";

export const config = {
  maxDuration: 10,
};

const toFiniteNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const sanitizeGiftMessage = (message) => String(message || "").trim().slice(0, 180);

const getProductId = (product) => {
  if (!product) return "";
  if (typeof product === "string") return product;
  if (typeof product === "object" && product?._id) return String(product._id);
  return "";
};

const sanitizeOrderItems = (items) => {
  if (!Array.isArray(items)) return [];

  return items
    .map((item) => {
      const quantity = Math.max(toFiniteNumber(item?.quantity), 0);
      const productId = getProductId(item?.product);
      const giftWrap = Boolean(item?.giftWrap);
      const isGift = Boolean(item?.isGift);
      const giftWrapCharge = giftWrap
        ? Math.max(
            toFiniteNumber(item?.giftWrapCharge) || CHECKOUT_STANDARD_GIFT_WRAP_CHARGE,
            0
          )
        : 0;

      return {
        ...item,
        product: productId,
        quantity,
        isGift,
        giftWrap,
        giftWrapCharge,
        giftMessage: isGift ? sanitizeGiftMessage(item?.giftMessage) : "",
      };
    })
    .filter((item) => Boolean(item.product) && item.quantity > 0);
};

const getGiftWrapTotalFromItems = (items) => {
  if (!Array.isArray(items)) return 0;
  const hasGiftWrap = items.some((item) => Boolean(item?.giftWrap));
  return hasGiftWrap ? CHECKOUT_STANDARD_GIFT_WRAP_CHARGE : 0;
};

const processOrder = async (orderItems) => {
  try {
    for (const orderItem of orderItems) {
      const productId = getProductId(orderItem?.product);
      const quantity = Math.max(toFiniteNumber(orderItem?.quantity), 0);

      if (!productId || quantity <= 0) {
        continue;
      }

      const foundProduct = await ProductModel.findById(productId);
      if (!foundProduct) {
        throw new Error(`Product with ID ${productId} not found`);
      }

      if (foundProduct.quantity >= quantity) {
        foundProduct.quantity -= quantity;
        foundProduct.sold += quantity;
        await foundProduct.save();
      } else {
        throw new Error(`Not enough quantity available`);
      }
    }
    console.log("Inventory updated successfully");
  } catch (error) {
    console.error("Error updating inventory:", error.message);
  }
};

// Function to send email after 3 hours using the new "Order Dispatched" template
const msgAfter3hour = async (firstname, ordernumber, email, orderItems, finalAmount) => {
  // Generate order items string for the email
  const orderItemsString = orderItems?.map((item) => {
    return `• ${item.product.title} - ₹${item.product.price} x ${item.quantity}`;
  }).join('<br>');

  await sendEmail({
    to: email,
    subject: "Your Order is on the Way! - You & Me Jewelry",
    text: `Your order #${ordernumber} has been dispatched and is on its way to you.`,
    htmlContent: `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Your Order is on the Way</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f8f9fa;">
    <div style="background: #f8f9fa; padding: 40px 20px;">
        <table width="100%" border="0" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
            <!-- Header -->
            <tr>
                <td style="background: linear-gradient(135deg, #d4af37 0%, #c49f31 100%); padding: 40px 30px; text-align: center;">
                    <h1 style="color: white; margin: 0 0 10px; font-size: 32px; letter-spacing: 2px; font-family: Arial, sans-serif;">YOU & ME</h1>
                    <p style="color: rgba(255,255,255,0.9); margin: 0; font-size: 14px; letter-spacing: 1px; font-family: Arial, sans-serif;">FINE JEWELRY</p>
                </td>
            </tr>
            
            <!-- Content -->
            <tr>
                <td style="padding: 40px 30px;">
                    <div style="text-align: center; margin-bottom: 30px;">
                        <div style="width: 80px; height: 80px; background: #dbeafe; border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
                            <span style="font-size: 40px;">📦</span>
                        </div>
                        <h2 style="color: #1a1a1a; margin: 0 0 10px; font-size: 28px; font-family: Arial, sans-serif;">Your Order is on the Way!</h2>
                        <p style="color: #666; margin: 0; font-size: 16px; font-family: Arial, sans-serif;">Order #${ordernumber} has been dispatched</p>
                    </div>
                    
                    <!-- Order Items Summary -->
                    <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
                        <h3 style="color: #333; margin: 0 0 15px; font-size: 16px; font-family: Arial, sans-serif;">Your Order Items</h3>
                        <div style="color: #666; font-size: 14px; line-height: 1.6; font-family: Arial, sans-serif;">
                            ${orderItemsString}
                        </div>
                        <div style="border-top: 1px solid #ddd; margin-top: 15px; padding-top: 15px;">
                            <p style="color: #333; margin: 0; font-size: 16px; font-weight: bold; font-family: Arial, sans-serif;">
                                Total Amount: <span style="color: #d4af37;">₹${finalAmount}</span>
                            </p>
                        </div>
                    </div>
                    
                    <!-- Tracking Info -->
                    <div style="background: #f8f9fa; border-radius: 8px; padding: 25px; margin-bottom: 30px; text-align: center;">
                        <p style="color: #666; margin: 0 0 15px; font-size: 14px; font-family: Arial, sans-serif;">Tracking Number</p>
                        <p style="color: #333; margin: 0 0 20px; font-size: 20px; font-weight: bold; letter-spacing: 1px; font-family: Arial, sans-serif;">TR${ordernumber}IN</p>
                        <p style="color: #666; margin: 0 0 5px; font-size: 14px; font-family: Arial, sans-serif;">Estimated Delivery</p>
                        <p style="color: #d4af37; margin: 0; font-size: 18px; font-weight: bold; font-family: Arial, sans-serif;">Within 3-5 Business Days</p>
                    </div>
                    
                    <!-- Progress Timeline -->
                    <div style="margin-bottom: 30px;">
                        <table width="100%" border="0" cellpadding="0" cellspacing="0">
                            <tr>
                                <td style="width: 33.33%; text-align: center; padding: 10px;">
                                    <div style="width: 40px; height: 40px; background: #10b981; border-radius: 50%; margin: 0 auto 10px; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold;">✓</div>
                                    <p style="margin: 0; font-size: 12px; color: #333; font-family: Arial, sans-serif;">Confirmed</p>
                                </td>
                                <td style="width: 33.33%; text-align: center; padding: 10px;">
                                    <div style="width: 40px; height: 40px; background: #3b82f6; border-radius: 50%; margin: 0 auto 10px; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold;">→</div>
                                    <p style="margin: 0; font-size: 12px; color: #333; font-weight: bold; font-family: Arial, sans-serif;">In Transit</p>
                                </td>
                                <td style="width: 33.33%; text-align: center; padding: 10px;">
                                    <div style="width: 40px; height: 40px; background: #e5e7eb; border-radius: 50%; margin: 0 auto 10px; display: flex; align-items: center; justify-content: center; color: #999; font-weight: bold;">📍</div>
                                    <p style="margin: 0; font-size: 12px; color: #999; font-family: Arial, sans-serif;">Delivered</p>
                                </td>
                            </tr>
                        </table>
                    </div>
                    
                    <div style="text-align: center;">
                        <a href="#" style="display: inline-block; background: linear-gradient(135deg, #d4af37, #c49f31); color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; font-family: Arial, sans-serif;">Track Package</a>
                    </div>
                </td>
            </tr>
            
            <!-- Footer -->
            <tr>
                <td style="background: #1a1a1a; padding: 30px; text-align: center;">
                    <p style="color: #999; margin: 0 0 15px; font-size: 14px; font-family: Arial, sans-serif;">Questions? Contact us at support@youandme.com</p>
                    <p style="color: #666; margin: 0; font-size: 12px; font-family: Arial, sans-serif;">© 2024 You & Me Jewelry. All rights reserved.</p>
                </td>
            </tr>
        </table>
    </div>
</body>
</html>
    `
  });
};

const validateOrderPricesAndAmounts = async (orderItems, totalPrice, finalAmount, discount, shippingCost) => {
  try {
    let calculatedTotalPrice = 0;

    for (const orderItem of orderItems) {
      const productId = getProductId(orderItem?.product);
      const quantity = Math.max(toFiniteNumber(orderItem?.quantity), 0);

      const foundProduct = await ProductModel.findById(productId);

      if (!foundProduct) {
        throw new Error(`Product with ID ${productId} not found`);
      }

      calculatedTotalPrice += foundProduct.price * quantity;

      if (foundProduct.quantity < quantity) {
        throw new Error(`Not enough quantity available`);
      }
    }

    if (calculatedTotalPrice !== totalPrice) {
      throw new Error(
        `Total price mismatch. Expected: ₹${calculatedTotalPrice}, Received: ₹${totalPrice}`
      );
    }

    const expectedFinalAmount = calculatedTotalPrice - discount + shippingCost;

    if (expectedFinalAmount !== finalAmount) {
      throw new Error(
        `Final amount mismatch. Expected: ₹${expectedFinalAmount}, Received: ₹${finalAmount}`
      );
    }

    console.log("All prices and amounts validated successfully");
  } catch (error) {
    throw new Error(error.message);
  }
};

export async function POST(req,res){
  const body = await req.text();
  const parsedBody = JSON.parse(body);

  const {
    shippingInfo,
    orderItems,
    totalPrice,
    finalAmount,
    shippingCost,
    codCharge = 0,
    orderType,
    discount,
    paymentInfo,
    isPartial,
    tag,
  } = parsedBody;
  
  try {
    await connectDb()

    const normalizedOrderItems = sanitizeOrderItems(orderItems);
    if (!normalizedOrderItems.length) {
      return Response.json(
        { success: false, error: "Order must include at least one valid item" },
        { status: 400 }
      );
    }

    const normalizedTotalPrice = Math.max(toFiniteNumber(totalPrice), 0);
    const normalizedShippingCost = Math.max(toFiniteNumber(shippingCost), 0);
    const normalizedDiscount = Math.max(toFiniteNumber(discount), 0);
    const normalizedOrderType =
      String(orderType || "").toUpperCase() === "COD" ? "COD" : "Prepaid";
    const normalizedGiftWrapTotal = getGiftWrapTotalFromItems(normalizedOrderItems);
    const requestedCodCharge = Math.max(toFiniteNumber(codCharge), 0);
    const inferredCodCharge = Math.max(
      toFiniteNumber(finalAmount) -
        (normalizedTotalPrice +
          normalizedGiftWrapTotal +
          normalizedShippingCost -
          normalizedDiscount),
      0
    );
    const normalizedCodCharge =
      normalizedOrderType === "COD"
        ? requestedCodCharge > 0
          ? requestedCodCharge
          : inferredCodCharge > 0
            ? inferredCodCharge
            : CHECKOUT_STANDARD_COD_CHARGE
        : 0;
    const normalizedPaymentInfo = {
      razorpayOrderId:
        String(paymentInfo?.razorpayOrderId || "").trim() ||
        (normalizedOrderType === "COD" ? "COD" : "MANUAL"),
      razorpayPaymentId:
        String(paymentInfo?.razorpayPaymentId || "").trim() ||
        (normalizedOrderType === "COD" ? "COD" : "MANUAL"),
      ...(paymentInfo?.paymentId
        ? { paymentId: String(paymentInfo.paymentId) }
        : {}),
    };
    const resolvedFinalAmount =
      normalizedTotalPrice +
      normalizedGiftWrapTotal +
      normalizedShippingCost +
      normalizedCodCharge -
      normalizedDiscount;

    // await validateOrderPricesAndAmounts(orderItems, totalPrice, finalAmount, discount, shippingCost);

    for (const orderItem of normalizedOrderItems) {
      const productId = getProductId(orderItem?.product);
      const quantity = Math.max(toFiniteNumber(orderItem?.quantity), 0);

      const foundProduct = await ProductModel.findById(productId);

      if (!foundProduct) {
        throw new Error(`Product with ID ${productId} not found`);
      }

      if (foundProduct.quantity < quantity) {
        throw new Error(`Not enough quantity available`);
      }
    }

    // Create the order
    const order = await OrderModel.create({
      shippingInfo,
      orderItems: normalizedOrderItems,
      totalPrice: normalizedTotalPrice,
      finalAmount: resolvedFinalAmount,
      shippingCost: normalizedShippingCost,
      giftWrapTotal: normalizedGiftWrapTotal,
      codCharge: normalizedCodCharge,
      orderType: normalizedOrderType,
      discount: normalizedDiscount,
      paymentInfo: normalizedPaymentInfo,
      tag,
      isPartial
    });
    
    const order1 = await OrderModel.findById(order._id).populate("orderItems.product")
    
    // Generate order items string for confirmation email
    const orderItemsString = order1?.orderItems.map((item) => {
        return `• ${item.product.title} - ₹${item.product.price} x ${item.quantity}`;
    }).join('<br>');

    // Send confirmation email using the new template
    await sendEmail({
      to: `${shippingInfo.email}`,
      subject: "Order Confirmed! - You & Me Jewelry",
      text: `Your order #${order.orderNumber} has been confirmed. Thank you for your purchase!`,
      htmlContent: `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Order Confirmed - You & Me Jewelry</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f8f9fa;">
    <div style="background: #f8f9fa; padding: 40px 20px;">
        <table width="100%" border="0" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
            <!-- Header -->
            <tr>
                <td style="background: linear-gradient(135deg, #d4af37 0%, #c49f31 100%); padding: 40px 30px; text-align: center;">
                    <h1 style="color: white; margin: 0 0 10px; font-size: 32px; letter-spacing: 2px; font-family: Arial, sans-serif;">YOU & ME</h1>
                    <p style="color: rgba(255,255,255,0.9); margin: 0; font-size: 14px; letter-spacing: 1px; font-family: Arial, sans-serif;">FINE JEWELRY</p>
                </td>
            </tr>
            
            <!-- Content -->
            <tr>
                <td style="padding: 40px 30px;">
                    <div style="text-align: center; margin-bottom: 30px;">
                        <div style="width: 80px; height: 80px; background: #dcfce7; border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
                            <span style="font-size: 40px;">✓</span>
                        </div>
                        <h2 style="color: #1a1a1a; margin: 0 0 10px; font-size: 28px; font-family: Arial, sans-serif;">Order Confirmed!</h2>
                        <p style="color: #666; margin: 0; font-size: 16px; font-family: Arial, sans-serif;">Thank you for your purchase</p>
                    </div>
                    
                    <!-- Order Details -->
                    <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
                        <table width="100%" border="0" cellpadding="0" cellspacing="0">
                            <tr>
                                <td style="padding: 10px 0;">
                                    <strong style="color: #333; font-family: Arial, sans-serif;">Order Number:</strong><br>
                                    <span style="color: #d4af37; font-size: 18px; font-weight: bold; font-family: Arial, sans-serif;">#${order.orderNumber}</span>
                                </td>
                                <td style="padding: 10px 0; text-align: right;">
                                    <strong style="color: #333; font-family: Arial, sans-serif;">Order Date:</strong><br>
                                    <span style="color: #666; font-family: Arial, sans-serif;">${new Date().toLocaleDateString()}</span>
                                </td>
                            </tr>
                        </table>
                    </div>
                    
                    <!-- Product Items -->
                    <div style="border-top: 2px solid #f0f0f0; padding-top: 20px; margin-bottom: 30px;">
                        <h3 style="color: #333; margin: 0 0 20px; font-size: 18px; font-family: Arial, sans-serif;">Order Items</h3>
                        
                        <div style="margin-bottom: 15px;">
                            <div style="padding: 15px; background: #f8f9fa; border-radius: 8px;">
                                <div style="color: #666; font-size: 14px; line-height: 1.6; font-family: Arial, sans-serif;">
                                    ${orderItemsString}
                                </div>
                            </div>
                        </div>
                        
                        <!-- Order Summary -->
                        <div style="border-top: 2px solid #f0f0f0; padding-top: 20px;">
                            <table width="100%" border="0" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td style="padding: 8px 0; color: #666; font-family: Arial, sans-serif;">Subtotal:</td>
                                    <td style="padding: 8px 0; text-align: right; color: #666; font-family: Arial, sans-serif;">₹${normalizedTotalPrice}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0; color: #666; font-family: Arial, sans-serif;">Shipping:</td>
                                    <td style="padding: 8px 0; text-align: right; color: #10b981; font-weight: bold; font-family: Arial, sans-serif;">${normalizedShippingCost === 0 ? 'FREE' : `₹${normalizedShippingCost}`}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 15px 0 0; font-size: 18px; font-weight: bold; color: #333; font-family: Arial, sans-serif;">Total:</td>
                                    <td style="padding: 15px 0 0; text-align: right; font-size: 20px; font-weight: bold; color: #d4af37; font-family: Arial, sans-serif;">₹${resolvedFinalAmount}</td>
                                </tr>
                            </table>
                        </div>
                    </div>
                    
                    <!-- Shipping Address -->
                    <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
                        <h3 style="color: #333; margin: 0 0 15px; font-size: 16px; font-family: Arial, sans-serif;">Shipping Address</h3>
                        <p style="color: #666; margin: 0; line-height: 1.6; font-family: Arial, sans-serif;">
                            <strong>${shippingInfo.firstname} ${shippingInfo.lastname}</strong><br>
                            ${shippingInfo.address}<br>
                            ${shippingInfo.city}, ${shippingInfo.state} - ${shippingInfo.pincode}<br>
                            Phone: ${shippingInfo.phone}
                        </p>
                    </div>
                    
                    <!-- CTA Button -->
                    <div style="text-align: center;">
                        <a href="#" style="display: inline-block; background: linear-gradient(135deg, #d4af37, #c49f31); color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; font-family: Arial, sans-serif;">Track Your Order</a>
                    </div>
                </td>
            </tr>
            
            <!-- Footer -->
            <tr>
                <td style="background: #1a1a1a; padding: 30px; text-align: center;">
                    <p style="color: #999; margin: 0 0 15px; font-size: 14px; font-family: Arial, sans-serif;">Need help? Contact us at support@youandme.com</p>
                    <div style="margin: 20px 0;">
                        <a href="#" style="color: #d4af37; text-decoration: none; margin: 0 10px; font-family: Arial, sans-serif;">Instagram</a>
                        <a href="#" style="color: #d4af37; text-decoration: none; margin: 0 10px; font-family: Arial, sans-serif;">Facebook</a>
                        <a href="#" style="color: #d4af37; text-decoration: none; margin: 0 10px; font-family: Arial, sans-serif;">Pinterest</a>
                    </div>
                    <p style="color: #666; margin: 0; font-size: 12px; font-family: Arial, sans-serif;">© 2024 You & Me Jewelry. All rights reserved.</p>
                </td>
            </tr>
        </table>
    </div>
</body>
</html>
      `
    });

    const { firstname, lastname, email, phone, address } = shippingInfo;

    // Check if the user already exists
    let user = await UserModel.findOne({ email });

    // If the user doesn't exist, create a new user
    if (!user) {
      user = await UserModel.create({
        email,
        firstname,
        lastname,
        mobile: phone,
        address
      });
    }

    // Update the inventory
    await processOrder(normalizedOrderItems);

    // Schedule a message after 3 hours with order details
    setTimeout(async () => {
      const populatedOrder = await OrderModel.findById(order._id).populate("orderItems.product");
      await msgAfter3hour(
        shippingInfo.firstname, 
        order.orderNumber, 
        shippingInfo.email,
        populatedOrder.orderItems,
        order.finalAmount
      );
    }, 10800000); // 3 hours in milliseconds
  
    return Response.json(
      { success: true, status: "Order Created", amount: order.finalAmount, firstname: order.shippingInfo.firstname, orderNumber: order.orderNumber },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error Creating Order:", error.message);
    return Response.json(
      { success: false, error: "Failed to create order" },
      { status: 500 }
    );
  }
};
