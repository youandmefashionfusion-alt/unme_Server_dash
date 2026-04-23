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

const BRAND_OWNER_EMAIL = "unmejewels@gmail.com";
const EXTERNAL_CALL_TIMEOUT_MS = 10000;
const PREPAID_ORDER_TYPES = new Set(["prepaid", "payu", "online", "pre-paid"]);
const COD_ORDER_TYPES = new Set(["cod", "cash on delivery", "cashondelivery"]);

const toFiniteNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const escapeHtml = (value) =>
  String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const formatInr = (value) => Number(value || 0).toLocaleString("en-IN");

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

      return {
        product: productId,
        quantity,
        isGift,
        giftWrap,
        giftWrapCharge: giftWrap ? CHECKOUT_STANDARD_GIFT_WRAP_CHARGE : 0,
        giftMessage: isGift ? sanitizeGiftMessage(item?.giftMessage) : "",
      };
    })
    .filter((item) => Boolean(item.product) && item.quantity > 0);
};

const calculateGiftWrapTotal = (items) => {
  if (!Array.isArray(items)) return 0;
  return items.some((item) => item?.giftWrap) ? CHECKOUT_STANDARD_GIFT_WRAP_CHARGE : 0;
};

const sanitizeShippingInfo = (shippingInfo = {}) => {
  const rawPhone = String(shippingInfo?.phone ?? "").trim();
  const phoneDigits = rawPhone.replace(/\D/g, "");
  const numericPhone = phoneDigits ? Number(phoneDigits) : toFiniteNumber(rawPhone);

  const rawPincode = String(shippingInfo?.pincode ?? "").trim();
  const pincodeDigits = rawPincode.replace(/\D/g, "");
  const numericPincode = pincodeDigits ? Number(pincodeDigits) : toFiniteNumber(rawPincode);

  return {
    firstname: String(shippingInfo?.firstname || "").trim(),
    lastname: String(shippingInfo?.lastname || "").trim(),
    email: String(shippingInfo?.email || "").trim(),
    phone: numericPhone,
    address: String(shippingInfo?.address || "").trim(),
    city: String(shippingInfo?.city || "").trim(),
    state: String(shippingInfo?.state || "").trim(),
    pincode: numericPincode,
  };
};

const hasValidShippingInfo = (shippingInfo = {}) =>
  Boolean(
    shippingInfo.firstname &&
      shippingInfo.lastname &&
      shippingInfo.email &&
      Number(shippingInfo.phone) > 0 &&
      shippingInfo.address &&
      shippingInfo.city &&
      shippingInfo.state &&
      Number(shippingInfo.pincode) > 0
  );

const formatOrderItemLine = (item) => {
  const giftMessageSuffix =
    item?.isGift && item?.giftMessage ? ` (Gift message: ${item.giftMessage})` : "";

  return `- ${item?.product?.title || "Product"} - Rs${Number(
    item?.product?.price || 0
  ).toLocaleString("en-IN")} x ${item?.quantity || 0}${giftMessageSuffix}`;
};

const orderConfirmationEmail = ({
  orderNumber,
  shippingInfo,
  orderItems,
  totalPrice,
  finalAmount,
  shippingCost,
  discount,
  giftWrapTotal,
  codCharge,
}) => {
  const itemsHtml = (orderItems || [])
    .map((item) => {
      const giftMessage =
        item?.isGift && item?.giftMessage
          ? `<div style="color:#7A7067;font-size:12px;margin-top:4px;">Gift message: ${escapeHtml(
              item.giftMessage
            )}</div>`
          : "";

      return `<li style="margin-bottom:8px;">${escapeHtml(
        item?.product?.title || "Product"
      )} - Qty ${Number(item?.quantity || 0)} - Rs${formatInr(
        item?.product?.price || 0
      )}${giftMessage}</li>`;
    })
    .join("");

  return `
    <div style="font-family:Arial,sans-serif;color:#1A1612;">
      <h2>Order Confirmed - #${escapeHtml(orderNumber)}</h2>
      <p>Hi ${escapeHtml(shippingInfo?.firstname || "Customer")}, your order is confirmed.</p>
      <ul style="padding-left:18px;">${itemsHtml}</ul>
      <p>Subtotal: Rs${formatInr(totalPrice)}</p>
      ${giftWrapTotal > 0 ? `<p>Gift Wrap: Rs${formatInr(giftWrapTotal)}</p>` : ""}
      <p>Shipping: ${Number(shippingCost || 0) === 0 ? "FREE" : `Rs${formatInr(shippingCost)}`}</p>
      ${codCharge > 0 ? `<p>COD Charges: Rs${formatInr(codCharge)}</p>` : ""}
      ${discount > 0 ? `<p>Discount: -Rs${formatInr(discount)}</p>` : ""}
      <p><strong>Total: Rs${formatInr(finalAmount)}</strong></p>
    </div>
  `;
};

const orderDispatchedEmail = ({ orderNumber, firstname, orderItems, finalAmount }) => {
  const itemsHtml = (orderItems || [])
    .map(
      (item) =>
        `<li>${escapeHtml(item?.product?.title || "Product")} - Qty ${Number(
          item?.quantity || 0
        )}</li>`
    )
    .join("");

  return `
    <div style="font-family:Arial,sans-serif;color:#1A1612;">
      <h2>Your Order Is On The Way - #${escapeHtml(orderNumber)}</h2>
      <p>Hi ${escapeHtml(firstname || "Customer")}, your order has been dispatched.</p>
      <ul style="padding-left:18px;">${itemsHtml}</ul>
      <p><strong>Final Amount: Rs${formatInr(finalAmount)}</strong></p>
    </div>
  `;
};

const buildOwnerOrderEmailHtml = ({
  orderNumber,
  shippingInfo,
  orderItems,
  finalAmount,
  totalPrice,
  shippingCost,
  discount,
  giftWrapTotal,
  codCharge,
  orderType,
}) => {
  const itemsHtml = (orderItems || [])
    .map((item) => {
      const giftMeta =
        item?.isGift && item?.giftMessage
          ? `<div style="color:#7A7067;font-size:12px;margin-top:4px;">Gift message: ${escapeHtml(
              item.giftMessage
            )}</div>`
          : "";

      return `
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #E6E0D6;">
            <div style="font-size:14px;color:#1A1612;font-weight:600;">${escapeHtml(
              item?.product?.title || "Product"
            )}</div>
            <div style="font-size:13px;color:#4A4540;">Qty: ${Number(
              item?.quantity || 0
            )} | Price: Rs${formatInr(item?.product?.price || 0)}</div>
            ${giftMeta}
          </td>
        </tr>
      `;
    })
    .join("");

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>New Order Received</title>
</head>
<body style="margin:0;padding:20px;background:#FAF8F4;font-family:Arial,sans-serif;color:#1A1612;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:680px;margin:0 auto;background:#FFFFFF;border:1px solid #E6E0D6;">
    <tr>
      <td style="padding:20px;border-bottom:1px solid #E6E0D6;">
        <h2 style="margin:0;font-size:22px;">New Order Received</h2>
        <p style="margin:8px 0 0;color:#7A7067;">Order #${escapeHtml(orderNumber)}</p>
      </td>
    </tr>
    <tr>
      <td style="padding:20px;">
        <h3 style="margin:0 0 10px;font-size:16px;">Customer Details</h3>
        <p style="margin:4px 0;">Name: ${escapeHtml(shippingInfo?.firstname || "")} ${escapeHtml(
    shippingInfo?.lastname || ""
  )}</p>
        <p style="margin:4px 0;">Email: ${escapeHtml(shippingInfo?.email || "-")}</p>
        <p style="margin:4px 0;">Phone: ${escapeHtml(shippingInfo?.phone || "-")}</p>
        <p style="margin:4px 0;">Address: ${escapeHtml(shippingInfo?.address || "-")}, ${escapeHtml(
    shippingInfo?.city || "-"
  )}, ${escapeHtml(shippingInfo?.state || "-")} - ${escapeHtml(shippingInfo?.pincode || "-")}</p>
      </td>
    </tr>
    <tr>
      <td style="padding:0 20px 20px;">
        <h3 style="margin:0 0 10px;font-size:16px;">Order Items</h3>
        <table width="100%" cellpadding="0" cellspacing="0">
          ${itemsHtml}
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:0 20px 20px;">
        <h3 style="margin:0 0 10px;font-size:16px;">Payment Summary</h3>
        <p style="margin:4px 0;">Order Type: ${escapeHtml(orderType || "-")}</p>
        <p style="margin:4px 0;">Subtotal: Rs${formatInr(totalPrice)}</p>
        ${giftWrapTotal > 0 ? `<p style="margin:4px 0;">Gift Wrap: Rs${formatInr(giftWrapTotal)}</p>` : ""}
        <p style="margin:4px 0;">Shipping: ${
          Number(shippingCost || 0) === 0 ? "FREE" : `Rs${formatInr(shippingCost)}`
        }</p>
        ${codCharge > 0 ? `<p style="margin:4px 0;">COD Charges: Rs${formatInr(codCharge)}</p>` : ""}
        ${discount > 0 ? `<p style="margin:4px 0;">Discount: -Rs${formatInr(discount)}</p>` : ""}
        <p style="margin:8px 0 0;font-weight:700;font-size:16px;">Final Amount: Rs${formatInr(
          finalAmount
        )}</p>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
};

const safeFetch = async (url, options = {}, label = "external-call") => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), EXTERNAL_CALL_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      console.error(
        `[create-order] ${label} failed: ${response.status} ${response.statusText}${
          body ? ` | ${body}` : ""
        }`
      );
    }
  } catch (error) {
    console.error(`[create-order] ${label} failed: ${error.message}`);
  } finally {
    clearTimeout(timeout);
  }
};

const safeSendEmail = async (payload, label = "email") => {
  try {
    const result = await sendEmail(payload);
    if (!result?.success) {
      console.error(
        `[create-order] ${label} failed: ${result?.error || "sendEmail returned unsuccessful response"}`
      );
    }
  } catch (error) {
    console.error(`[create-order] ${label} failed: ${error.message}`);
  }
};

const processOrder = async (orderItems) => {
  try {
    for (const orderItem of orderItems) {
      const productId = getProductId(orderItem?.product);
      const quantity = Math.max(toFiniteNumber(orderItem?.quantity), 0);

      if (!productId || quantity <= 0) continue;

      const foundProduct = await ProductModel.findById(productId);
      if (!foundProduct) {
        throw new Error(`Product with ID ${productId} not found`);
      }

      if (foundProduct.quantity < quantity) {
        throw new Error("Not enough quantity available");
      }

      foundProduct.quantity -= quantity;
      foundProduct.sold += quantity;
      await foundProduct.save();
    }
  } catch (error) {
    console.error("Error updating inventory:", error.message);
  }
};

const msgAfter3hour = async (firstname, ordernumber, email, orderItems, finalAmount) => {
  await safeSendEmail(
    {
      to: email,
      subject: "Your Order is on the Way! - U n Me Jewelry",
      text: `Your order #${ordernumber} has been dispatched and is on its way to you.`,
      htmlContent: orderDispatchedEmail({
        orderNumber: ordernumber,
        firstname,
        orderItems,
        finalAmount,
      }),
    },
    "email-customer-order-dispatched"
  );
};

const validateOrderPricesAndAmounts = async (
  orderItems,
  totalPrice,
  finalAmount,
  discount,
  shippingCost,
  giftWrapTotal,
  codCharge
) => {
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
      throw new Error("Not enough quantity available");
    }
  }

  if (calculatedTotalPrice !== totalPrice) {
    throw new Error(
      `Total price mismatch. Expected: Rs${calculatedTotalPrice}, Received: Rs${totalPrice}`
    );
  }

  const expectedFinalAmount =
    calculatedTotalPrice + giftWrapTotal + shippingCost + codCharge - discount;

  if (expectedFinalAmount !== finalAmount) {
    throw new Error(
      `Final amount mismatch. Expected: Rs${expectedFinalAmount}, Received: Rs${finalAmount}`
    );
  }
};

export async function POST(req) {
  let parsedBody = {};
  try {
    parsedBody = await req.json();
  } catch {
    return Response.json(
      { success: false, error: "Invalid request body" },
      { status: 400 }
    );
  }

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
    tag,
    isPartial,
  } = parsedBody || {};

  const sanitizedOrderItems = sanitizeOrderItems(orderItems);
  const normalizedShippingInfo = sanitizeShippingInfo(shippingInfo);

  if (!sanitizedOrderItems.length) {
    return Response.json(
      { success: false, error: "Order must include at least one valid item" },
      { status: 400 }
    );
  }

  if (!hasValidShippingInfo(normalizedShippingInfo)) {
    return Response.json(
      { success: false, error: "Invalid shipping info" },
      { status: 400 }
    );
  }

  const normalizedTotalPrice = Math.max(toFiniteNumber(totalPrice), 0);
  const normalizedShippingCost = Math.max(toFiniteNumber(shippingCost), 0);
  const normalizedDiscount = Math.max(toFiniteNumber(discount), 0);
  const requestedOrderType = String(orderType || "").trim().toLowerCase();
  const paymentTypeHints = [
    String(paymentInfo?.razorpayOrderId || "").trim().toLowerCase(),
    String(paymentInfo?.razorpayPaymentId || "").trim().toLowerCase(),
    String(paymentInfo?.paymentId || "").trim().toLowerCase(),
  ];
  const isCodByPaymentInfo = paymentTypeHints.some((value) => value === "cod");
  const normalizedOrderType =
    COD_ORDER_TYPES.has(requestedOrderType) || isCodByPaymentInfo ? "COD" : "Prepaid";
  const normalizedGiftWrapTotal = calculateGiftWrapTotal(sanitizedOrderItems);
  const normalizedRazorpayAmountPaise = Math.max(
    toFiniteNumber(paymentInfo?.razorpayAmountPaise ?? paymentInfo?.amount),
    0
  );
  const normalizedLineItemsTotalPaise = Math.max(
    toFiniteNumber(paymentInfo?.lineItemsTotalPaise ?? paymentInfo?.line_items_total),
    0
  );
  const requestedCodCharge = Math.max(toFiniteNumber(codCharge), 0);
  const inferredCodCharge = Math.max(
    toFiniteNumber(finalAmount) -
      (normalizedTotalPrice + normalizedGiftWrapTotal + normalizedShippingCost - normalizedDiscount),
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
      ? { paymentId: String(paymentInfo.paymentId).trim() }
      : {}),
    ...(normalizedRazorpayAmountPaise > 0
      ? { razorpayAmountPaise: normalizedRazorpayAmountPaise }
      : {}),
    ...(normalizedLineItemsTotalPaise > 0
      ? { lineItemsTotalPaise: normalizedLineItemsTotalPaise }
      : {}),
    ...(paymentInfo?.currency
      ? { currency: String(paymentInfo.currency).trim().toUpperCase() }
      : {}),
    ...(paymentInfo?.receipt
      ? { receipt: String(paymentInfo.receipt).trim() }
      : {}),
  };
  const computedFinalAmount =
    normalizedTotalPrice +
    normalizedGiftWrapTotal +
    normalizedShippingCost +
    normalizedCodCharge -
    normalizedDiscount;
  const resolvedFinalAmount =
    normalizedOrderType === "Prepaid" && normalizedRazorpayAmountPaise > 0
      ? Number((normalizedRazorpayAmountPaise / 100).toFixed(2))
      : computedFinalAmount;

  try {
    await connectDb();

    const isRequestedPrepaid =
      normalizedOrderType === "Prepaid" || PREPAID_ORDER_TYPES.has(requestedOrderType);
    const prepaidTransactionId = String(
      paymentInfo?.razorpayPaymentId || paymentInfo?.paymentId || ""
    ).trim();

    // Idempotency guard: payment gateways can retry callbacks for the same prepaid transaction.
    // Return existing order instead of creating duplicates.
    if (
      isRequestedPrepaid &&
      prepaidTransactionId &&
      prepaidTransactionId.toUpperCase() !== "MANUAL"
    ) {
      const existingOrder = await OrderModel.findOne({
        $or: [
          { "paymentInfo.razorpayPaymentId": prepaidTransactionId },
          { "paymentInfo.paymentId": prepaidTransactionId },
        ],
      }).lean();

      if (existingOrder) {
        return Response.json(
          {
            success: true,
            status: "Order Already Created",
            amount: existingOrder.finalAmount,
            firstname: existingOrder?.shippingInfo?.firstname || "",
            orderNumber: existingOrder.orderNumber,
          },
          { status: 200 }
        );
      }
    }

    // Keep parity with website route: validations can be re-enabled whenever needed.
    // await validateOrderPricesAndAmounts(
    //   sanitizedOrderItems,
    //   normalizedTotalPrice,
    //   resolvedFinalAmount,
    //   normalizedDiscount,
    //   normalizedShippingCost,
    //   normalizedGiftWrapTotal,
    //   normalizedCodCharge
    // );

    for (const orderItem of sanitizedOrderItems) {
      const productId = getProductId(orderItem?.product);
      const quantity = Math.max(toFiniteNumber(orderItem?.quantity), 0);
      const foundProduct = await ProductModel.findById(productId);

      if (!foundProduct) {
        throw new Error(`Product with ID ${productId} not found`);
      }

      if (foundProduct.quantity < quantity) {
        throw new Error("Not enough quantity available");
      }
    }

    const order = await OrderModel.create({
      shippingInfo: normalizedShippingInfo,
      orderItems: sanitizedOrderItems,
      totalPrice: normalizedTotalPrice,
      giftWrapTotal: normalizedGiftWrapTotal,
      finalAmount: resolvedFinalAmount,
      shippingCost: normalizedShippingCost,
      codCharge: normalizedCodCharge,
      orderType: normalizedOrderType,
      discount: normalizedDiscount,
      paymentInfo: normalizedPaymentInfo,
      tag,
      isPartial,
    });

    const populatedOrder = await OrderModel.findById(order._id).populate("orderItems.product");

    const orderItemsString = populatedOrder?.orderItems
      ?.map((item) => formatOrderItemLine(item))
      .join("<br>");
    const orderItemsWithGiftWrap =
      normalizedGiftWrapTotal > 0
        ? `${orderItemsString}<br>- Gift Wrap (Order Level): Rs${normalizedGiftWrapTotal}`
        : orderItemsString;

    const notificationTasks = [];

    notificationTasks.push(
      safeFetch(
        "https://watuska-production.up.railway.app/api/template/api-send/1398372561527099",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization:
              "Bearer wsk_live_a85bb2fc43ff3285ab17dea902052cfd5ae3de0d75a4e6bd848f1f8d23cd253d",
          },
          body: JSON.stringify({
            to: `+91${populatedOrder?.shippingInfo?.phone}`,
            templateName: "order_confirmation_client1",
            language: "en_US",
            variables: {
              1: populatedOrder?.shippingInfo?.firstname,
              2: populatedOrder?.orderNumber,
              3: orderItemsWithGiftWrap,
              4: `${populatedOrder?.finalAmount}`,
            },
            name: populatedOrder?.shippingInfo?.firstname,
          }),
        },
        "whatsapp-customer"
      )
    );

    notificationTasks.push(
      safeFetch(
        "https://watuska-production.up.railway.app/api/template/api-send/1252741026187542",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization:
              "Bearer wsk_live_53fa572dfb8b86f7b5da5bd9c41d52ba659daf4959cfa176a806e7c132b170c3",
          },
          body: JSON.stringify({
            to: "+916396230428",
            templateName: "new_order_admin",
            language: "en_US",
            variables: {
              1: populatedOrder?.orderNumber,
              2: populatedOrder?.shippingInfo?.firstname,
              3: populatedOrder?.shippingInfo?.phone,
              4: orderItemsWithGiftWrap,
              5: `${populatedOrder?.finalAmount}`,
              6: populatedOrder?.orderType,
            },
            name: "UnMe Orders",
          }),
        },
        "whatsapp-admin-1"
      )
    );

    notificationTasks.push(
      safeFetch(
        "https://watuska-production.up.railway.app/api/template/api-send/1252741026187542",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization:
              "Bearer wsk_live_53fa572dfb8b86f7b5da5bd9c41d52ba659daf4959cfa176a806e7c132b170c3",
          },
          body: JSON.stringify({
            to: "+917807178263",
            templateName: "new_order_admin",
            language: "en_US",
            variables: {
              1: populatedOrder?.orderNumber,
              2: populatedOrder?.shippingInfo?.firstname,
              3: populatedOrder?.shippingInfo?.phone,
              4: orderItemsWithGiftWrap,
              5: `${populatedOrder?.finalAmount}`,
              6: populatedOrder?.orderType,
            },
            name: "Divya Mam",
          }),
        },
        "whatsapp-admin-2"
      )
    );

    if (normalizedShippingInfo?.email) {
      notificationTasks.push(
        safeSendEmail(
          {
            to: normalizedShippingInfo.email,
            subject: "Order Confirmed! - U n Me Jewelry",
            text: `Your order #${order.orderNumber} has been confirmed. Thank you for your purchase!`,
            htmlContent: orderConfirmationEmail({
              orderNumber: order.orderNumber,
              shippingInfo: normalizedShippingInfo,
              orderItems: populatedOrder?.orderItems || [],
              totalPrice: normalizedTotalPrice,
              finalAmount: order.finalAmount,
              shippingCost: normalizedShippingCost,
              discount: normalizedDiscount,
              giftWrapTotal: normalizedGiftWrapTotal,
              codCharge: normalizedCodCharge,
            }),
          },
          "email-customer-order-confirmation"
        )
      );
    }

    notificationTasks.push(
      safeSendEmail(
        {
          to: BRAND_OWNER_EMAIL,
          subject: `New Order Received - #${order.orderNumber}`,
          text: `A new order #${order.orderNumber} has been placed. Customer: ${normalizedShippingInfo.firstname} ${normalizedShippingInfo.lastname}, Amount: Rs${formatInr(order.finalAmount)}.`,
          htmlContent: buildOwnerOrderEmailHtml({
            orderNumber: order.orderNumber,
            shippingInfo: normalizedShippingInfo,
            orderItems: populatedOrder?.orderItems || [],
            finalAmount: order.finalAmount,
            totalPrice: normalizedTotalPrice,
            shippingCost: normalizedShippingCost,
            discount: normalizedDiscount,
            giftWrapTotal: normalizedGiftWrapTotal,
            codCharge: normalizedCodCharge,
            orderType: normalizedOrderType,
          }),
        },
        "email-owner-new-order"
      )
    );

    await Promise.allSettled(notificationTasks);

    const { firstname, lastname, email, phone, address } = normalizedShippingInfo;
    if (email) {
      const existingUser = await UserModel.findOne({ email });
      if (!existingUser) {
        await UserModel.create({
          email,
          firstname,
          lastname,
          mobile: String(phone),
          address,
        });
      }
    }

    await processOrder(sanitizedOrderItems);

    setTimeout(async () => {
      try {
        if (!normalizedShippingInfo?.email) return;
        const delayedOrder = await OrderModel.findById(order._id).populate("orderItems.product");
        await msgAfter3hour(
          normalizedShippingInfo.firstname,
          order.orderNumber,
          normalizedShippingInfo.email,
          delayedOrder?.orderItems || [],
          order.finalAmount
        );
      } catch (error) {
        console.error(`[create-order] delayed-dispatch-email failed: ${error.message}`);
      }
    }, 10800000);

    return Response.json(
      {
        success: true,
        status: "Order Created",
        amount: order.finalAmount,
        firstname: order.shippingInfo.firstname,
        orderNumber: order.orderNumber,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error Creating Order:", error.message);
    return Response.json(
      { success: false, error: "Failed to create order" },
      { status: 500 }
    );
  }
}
