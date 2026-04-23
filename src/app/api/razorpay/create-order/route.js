import { NextResponse } from "next/server";

const getRazorpayCredentials = () => {
  const keyId =
    process.env.RAZORPAY_KEY_ID_LIVE ||
    process.env.RAZORPAY_KEY_ID_TEST ||
    process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;

  const keySecret =
    process.env.RAZORPAY_KEY_SECRET_LIVE ||
    process.env.RAZORPAY_KEY_SECRET_TEST ||
    process.env.NEXT_PUBLIC_RAZORPAY_KEY_SECRET;

  return { keyId, keySecret };
};

const toPaise = (value) => {
  const numeric = Number(value) || 0;
  return Math.max(Math.round(numeric), 0);
};

const buildFallbackLineItems = (amountInPaise, receipt) => {
  const ref = String(receipt || `rcpt_${Date.now()}`).slice(0, 40);
  return [
    {
      sku: `order-${ref}`,
      variant_id: `order-${ref}`,
      price: amountInPaise,
      offer_price: amountInPaise,
      quantity: 1,
      name: "U n Me Jewels Order",
      description: "Checkout order",
    },
  ];
};

const sanitizeLineItems = (lineItems) => {
  if (!Array.isArray(lineItems)) return [];

  return lineItems
    .map((item, index) => {
      const quantity = Math.max(Number(item?.quantity) || 1, 1);
      const price = toPaise(item?.price);
      const offerPrice = toPaise(item?.offer_price ?? item?.price);

      if (!price || !offerPrice) return null;

      const sku = String(item?.sku || `sku-${index + 1}`).slice(0, 64);
      const variantId = String(item?.variant_id || sku).slice(0, 64);
      const name = String(item?.name || "Product").slice(0, 255);
      const description = String(item?.description || "Product from cart").slice(0, 255);

      const normalized = {
        sku,
        variant_id: variantId,
        price,
        offer_price: offerPrice,
        quantity,
        name,
        description,
      };

      if (item?.image_url) normalized.image_url = String(item.image_url);
      if (item?.product_url) normalized.product_url = String(item.product_url);
      if (item?.weight) normalized.weight = Number(item.weight) || undefined;
      if (item?.dimensions && typeof item.dimensions === "object") {
        normalized.dimensions = item.dimensions;
      }
      if (item?.notes && typeof item.notes === "object") {
        normalized.notes = item.notes;
      }

      return normalized;
    })
    .filter(Boolean);
};

export async function POST(req) {
  try {
    const {
      amount,
      currency = "INR",
      receipt,
      notes,
      line_items_total,
      line_items,
    } = await req.json();

    if (!amount || Number(amount) <= 0) {
      return NextResponse.json(
        { success: false, message: "Invalid amount" },
        { status: 400 }
      );
    }

    const { keyId, keySecret } = getRazorpayCredentials();
    if (!keyId || !keySecret) {
      return NextResponse.json(
        { success: false, message: "Razorpay credentials are missing on server" },
        { status: 500 }
      );
    }

    const amountInPaise = Math.max(Math.round(Number(amount) * 100), 1);
    const sanitizedLineItems = sanitizeLineItems(line_items);
    const finalLineItems =
      sanitizedLineItems.length > 0
        ? sanitizedLineItems
        : buildFallbackLineItems(amountInPaise, receipt);

    const computedLineItemsTotal = finalLineItems.reduce(
      (sum, item) => sum + Number(item.offer_price || 0) * Number(item.quantity || 1),
      0
    );

    const lineItemsTotal = toPaise(line_items_total) || computedLineItemsTotal || amountInPaise;

    const options = {
      amount: amountInPaise,
      currency,
      receipt: receipt || `rcpt_${Date.now()}`,
      notes: notes && typeof notes === "object" ? notes : {},
      line_items_total: lineItemsTotal,
      line_items: finalLineItems,
    };

    const basicAuth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
    const razorpayResponse = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${basicAuth}`,
      },
      body: JSON.stringify(options),
      cache: "no-store",
    });

    const razorpayData = await razorpayResponse.json().catch(() => ({}));

    if (!razorpayResponse.ok) {
      return NextResponse.json(
        {
          success: false,
          message:
            razorpayData?.error?.description ||
            razorpayData?.message ||
            "Failed to create Razorpay order",
        },
        { status: razorpayResponse.status || 500 }
      );
    }

    return NextResponse.json({
      success: true,
      order: {
        id: razorpayData.id,
        amount: razorpayData.amount,
        currency: razorpayData.currency,
        receipt: razorpayData.receipt,
        line_items_total: razorpayData.line_items_total || lineItemsTotal,
      },
    });
  } catch (error) {
    console.error("Razorpay create order error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to create Razorpay order" },
      { status: 500 }
    );
  }
}
