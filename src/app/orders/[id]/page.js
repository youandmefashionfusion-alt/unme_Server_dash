"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useSelector } from "react-redux";
import {
  ArrowLeft,
  Edit,
  Printer,
  Check,
  X,
  Truck,
  RotateCcw,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Package,
  CreditCard,
  MessageSquare,
  History,
  Send,
  DollarSign,
  Tag,
} from "lucide-react";
import { useOrders } from "../../../../controller/useOrders";
import DelhiveryPanel from "../../../../components/DelhiveryPanel";
import styles from "../orders.module.css";
import toast from "react-hot-toast";
import { usePDF } from "react-to-pdf";
import {
  CHECKOUT_FREE_SHIPPING_THRESHOLD,
  resolveOrderShippingCost,
  resolveOrderCodCharge,
} from "../../../lib/orderPricing";

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.id;
  const { user } = useSelector((state) => state.auth);
  const { updateOrderStatus } = useOrders();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [comment, setComment] = useState("");
  const [showTracking, setShowTracking] = useState(false);
  const [tracking, setTracking] = useState({ partner: "", id: "", link: "" });
  const normalizedOrderType = String(order?.orderType || "").toUpperCase();
  const isCodOrder = normalizedOrderType === "COD";
  const isPrepaidOrder = normalizedOrderType === "PREPAID";

  const copyToClipboard = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied to clipboard!`);
    } catch (err) {
      toast.error("Failed to copy");
    }
  };

  const { toPDF, targetRef } = usePDF({
    filename: `packing-slip-${order?.orderNumber}.pdf`,
    page: {
      margin: { top: 8, right: 12, bottom: 8, left: 12 },
      format: "A4",
      orientation: "portrait",
    },
    canvas: {
      useCORS: true,
    },
  });

  const handleDownloadPackingSlip = async () => {
    try {
      await fetch("/api/order/set-history", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: user?.firstname || "Staff",
          orderId: order?._id,
          message: "Packing slip downloaded",
          time: new Date().toISOString(),
        }),
      });
    } catch (error) {
      console.error(
        "Failed to record packing slip download in history:",
        error,
      );
    } finally {
      toPDF(); // always trigger the PDF generation
    }
  };

  // Add second PDF ref
  const { toPDF: toPDF2, targetRef: targetRef2 } = usePDF({
    filename: `order-slip-${order?.orderNumber}.pdf`,
    page: {
      margin: { top: 12, right: 12, bottom: 8, left: 12 },
      format: "A4",
      orientation: "portrait",
    },
    canvas: {
      useCORS: true,
    },
  });

  // Handler for Slip 2
  const handleDownloadSlip2 = async () => {
    try {
      await fetch("/api/order/set-history", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: user?.firstname || "Staff",
          orderId: order?._id,
          message: "Order slip (Slip 2) downloaded",
          time: new Date().toISOString(),
        }),
      });
    } catch (error) {
      console.error("Failed to record slip download in history:", error);
    } finally {
      toPDF2(); // trigger PDF generation
    }
  };

  useEffect(() => {
    if (!orderId) return;
    fetchOrder();
  }, [orderId]);

  const fetchOrder = async () => {
    if (!orderId) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/order/single-order?id=${orderId}`);
      const data = await res.json();
      const orderPayload =
        data?.order && typeof data.order === "object" ? data.order : data;
      const hasValidOrder = Boolean(
        orderPayload && typeof orderPayload === "object" && orderPayload._id,
      );

      if (res.ok && hasValidOrder) {
        setOrder(orderPayload);
        if (orderPayload.trackingInfo) {
          setTracking({
            partner: orderPayload.trackingInfo.partner || "",
            id:
              orderPayload.trackingInfo.link
                ?.split("TrackingId: ")[1]
                ?.split(",")[0] || "",
            link:
              orderPayload.trackingInfo.link?.split("Tracking Link: ")[1] || "",
          });
        } else {
          setTracking({ partner: "", id: "", link: "" });
        }
      } else {
        toast.error("Order not found");
        setOrder(null);
        router.push("/orders");
      }
    } catch (error) {
      toast.error("Failed to load order");
      setOrder(null);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (action, data = {}) => {
    const success = await updateOrderStatus(orderId, action, data);
    const orderItemsString = (order?.orderItems || [])
      .map((item) => {
        return `- ${item.product.title} - Rs.${item.product.price} x ${item.quantity}`;
      })
      .join("<br>");
    if (action === "confirm") {
      const bodyForWatuska = {
        to: `+91${order?.shippingInfo?.phone}`,
        templateName: "order_confirmed_client",
        language: "en_US",
        variables: {
          1: order?.shippingInfo?.firstname,
          2: order?.orderNumber,
          3: orderItemsString,
          4: order?.finalAmount,
          5: order?.orderType,
        },
        name: order?.shippingInfo?.firstname,
      };

      await fetch("/api/whatsapp/proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: "https://watuska-production.up.railway.app/api/template/api-send/1422096086324574",
          method: "POST",
          headers: {
            Authorization:
              "Bearer wsk_live_7d2b7194c3432df51c698cf8e80a7f8073055428b9c65585b8ccfde42960c8aa",
          },
          body: bodyForWatuska,
        }),
      });
    }
    if (action === "tracking") {
      const bodyForWatuska = {
        to: `+91${order?.shippingInfo?.phone}`,
        templateName: "order_dispatched",
        language: "en_US",
        variables: {
          1: order?.shippingInfo?.firstname, // {{1}}
          2: order?.orderNumber, // {{2}}
          3: tracking?.id, // {{3}}
          4: tracking?.link, // {{4}}
        },
        name: order?.shippingInfo?.firstname,
      };

      await fetch("/api/whatsapp/proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: "https://watuska-production.up.railway.app/api/template/api-send/1573948597170279",
          method: "POST",
          headers: {
            Authorization:
              "Bearer wsk_live_2d3c73320f69aae8dda7ae7a1a914bb976a07c67db8a974d6b44aa9cebf56047",
          },
          body: bodyForWatuska,
        }),
      });
    }
    if (action === "delivery") {
      const bodyForWatuska = {
        to: `+91${order?.shippingInfo?.phone}`,
        templateName: "order_delivered",
        language: "en_US",
        variables: {
          1: order?.shippingInfo?.firstname, // {{1}}
          2: order?.orderNumber, // {{2}}
        },
        name: order?.shippingInfo?.firstname,
      };

      await fetch("/api/whatsapp/proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: "https://watuska-production.up.railway.app/api/template/api-send/906937008795245",
          method: "POST",
          headers: {
            Authorization:
              "Bearer wsk_live_87c4552c70b8844c24667a39f2b510c509047c2a0c0c79a5a4eeeb5096fe6618",
          },
          body: bodyForWatuska,
        }),
      });
      const bodyForWatuska1 = {
        to: `+91${order?.shippingInfo?.phone}`,
        templateName: "thank_you_msg",
        language: "en_US",
        variables: {
          1: order?.shippingInfo?.firstname, // {{1}}
          2: order?.orderNumber, // {{2}}
          3: `https://unmejewels.com/products/${order?.orderItems?.[0]?.product?.handle}`, // {{3}}
        },
        name: order?.shippingInfo?.firstname,
      };

      await fetch("/api/whatsapp/proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: "https://watuska-production.up.railway.app/api/template/api-send/1247745793973370",
          method: "POST",
          headers: {
            Authorization:
              "Bearer wsk_live_1fc4114e483ff7e8664c8ba674791f4622773ffce240bf4249ef3ca83728b07f",
          },
          body: bodyForWatuska1,
        }),
      });
    }
    if (success) {
      if (action === "tracking") setShowTracking(false);
      fetchOrder();
    }
  };

  const handleDelhiveryTrackingUpdate = async ({
    partner = "Delhivery",
    waybill,
    link,
    pickupDatetime,
    pickupId,
    sendEmailUpdate = true,
    updateOrderStatus = true,
  }) => {
    try {
      const existingWaybill =
        order?.trackingInfo?.trackingId ||
        order?.trackingInfo?.link
          ?.split("TrackingId: ")[1]
          ?.split(",")[0]
          ?.trim();
      const resolvedWaybill = waybill || existingWaybill || "";
      const resolvedTrackingLink = resolvedWaybill
        ? `https://www.delhivery.com/track/package/${resolvedWaybill}`
        : order?.trackingInfo?.trackingLink || "";
      const resolvedLink =
        link ||
        (resolvedWaybill
          ? `TrackingId: ${resolvedWaybill}, Tracking Link: ${resolvedTrackingLink}`
          : order?.trackingInfo?.link || "");

      const res = await fetch("/api/order/send-tracking", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          partner,
          trackingId: resolvedWaybill,
          trackingLink: resolvedTrackingLink,
          link: resolvedLink,
          pickupDatetime,
          pickupId,
          pickupRequestedAt: pickupDatetime
            ? new Date().toISOString()
            : undefined,
          sendEmailUpdate,
          updateOrderStatus,
          name: order?.shippingInfo?.firstname,
          ordernumber: order.orderNumber,
          email: order?.shippingInfo?.email,
          phone: order?.shippingInfo?.phone,
        }),
      });

      if (!res.ok) {
        const errorPayload = await res.json().catch(() => ({}));
        toast.error(errorPayload?.error || "Unable to save tracking details");
        return false;
      }

      const isPickupOnlyUpdate =
        Boolean(pickupDatetime || pickupId) && !sendEmailUpdate;
      toast.success(
        isPickupOnlyUpdate
          ? "Pickup details saved successfully!"
          : "Tracking saved & email sent to customer!",
      );
      await fetch("/api/order/set-history", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: user?.firstname,
          orderId: order?._id,
          message: isPickupOnlyUpdate
            ? `Pickup scheduled for ${pickupDatetime}${pickupId ? ` (Pickup ID: ${pickupId})` : ""}`
            : `Tracking details Sended :- TrackingId: ${resolvedWaybill}, Tracking Link: ${resolvedTrackingLink}`,
          time: new Date().toISOString(),
        }),
      });

      await fetchOrder();
      return true;
    } catch (error) {
      toast.error("Unable to save tracking details");
      return false;
    }
  };

  const addComment = async () => {
    if (!comment.trim()) {
      toast.error("Enter a comment");
      return;
    }
    try {
      const res = await fetch("/api/order/set-msg", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          name: user?.firstname,
          message: comment,
          time: new Date(),
        }),
      });
      if (res.ok) {
        toast.success("Comment added");
        setComment("");
        fetchOrder();
      }
    } catch (error) {
      toast.error("Failed to add comment");
    }
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const modifyCloudinaryUrl = (url) => {
    if (!url) return "/placeholder-image.jpg";

    const sanitizedUrl = String(url)
      .trim()
      .replace(/^\/\//, "https://")
      .replace(/^http:\/\//, "https://");
    const cloudfront = process.env.NEXT_PUBLIC_CLOUDFRONT_URL;

    // Convert S3 URL to CloudFront only when CloudFront is configured.
    if (
      (sanitizedUrl.includes("s3.") ||
        sanitizedUrl.includes("amazonaws.com")) &&
      cloudfront
    ) {
      try {
        const urlObj = new URL(sanitizedUrl);
        const pathname = urlObj.pathname;
        const normalizedCloudfront = cloudfront.replace(/\/$/, "");
        return `${normalizedCloudfront}${pathname}`;
      } catch (e) {
        return sanitizedUrl;
      }
    }

    // For direct S3 URLs without CloudFront, use original URL.
    if (
      sanitizedUrl.includes("s3.") ||
      sanitizedUrl.includes("amazonaws.com")
    ) {
      return sanitizedUrl;
    }

    // Apply Cloudinary transformations for Cloudinary URLs
    const urlParts = sanitizedUrl.split("/upload/");
    if (urlParts.length === 2) {
      return `${urlParts[0]}/upload/c_limit,h_300,f_auto,q_60/${urlParts[1]}`;
    }
    return sanitizedUrl;
  };

  const handleSlipImageError = (event) => {
    if (!event?.currentTarget?.src?.includes("/placeholder-image.jpg")) {
      event.currentTarget.src = "/placeholder-image.jpg";
    }
  };

  const getProductImageUrl = (product) => {
    const firstImage = product?.images?.[0];

    if (typeof firstImage === "string") {
      return modifyCloudinaryUrl(firstImage);
    }

    const resolvedUrl =
      firstImage?.url ||
      firstImage?.secure_url ||
      firstImage?.src ||
      product?.thumbnail ||
      "";

    return modifyCloudinaryUrl(resolvedUrl);
  };

  const getSlipImageUrl = (product) => {
    const resolved = getProductImageUrl(product);

    if (!resolved || resolved.startsWith("/")) {
      return resolved || "/placeholder-image.jpg";
    }

    return `/api/image-proxy?url=${encodeURIComponent(resolved)}`;
  };

  const getStatusClass = () => {
    if (!order) return "";
    if (order.orderStatus === "Cancelled") return styles.cancelled;
    return isCodOrder ? styles.cod : styles.prepaid;
  };

  const getStatusText = () => {
    if (!order) return "";
    if (order.orderStatus === "Cancelled") return "Cancelled";
    return isCodOrder ? "Cash on Delivery" : "Prepaid";
  };

  const getSafeNumber = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const orderItems = Array.isArray(order?.orderItems) ? order.orderItems : [];
  const shippingInfo = order?.shippingInfo || {};
  const trackingInfo = order?.trackingInfo || {};
  const orderSubtotal = getSafeNumber(order?.totalPrice);
  const orderShippingCost = resolveOrderShippingCost(order);
  const orderDiscount = Math.max(getSafeNumber(order?.discount), 0);
  const orderFinalAmount = getSafeNumber(order?.finalAmount);
  const orderCodCharge = resolveOrderCodCharge(order, orderShippingCost);
  const isFreeShipping = orderShippingCost === 0;
  const freeShippingNote = isFreeShipping
    ? orderSubtotal > CHECKOUT_FREE_SHIPPING_THRESHOLD
      ? `Free shipping unlocked on orders above Rs.${CHECKOUT_FREE_SHIPPING_THRESHOLD}`
      : "Free shipping applied via coupon/promotion"
    : "";

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner}></div>
        <p>Loading order...</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className={styles.error}>
        <Package size={48} />
        <h3>Order not found</h3>
        <p>The order you're looking for doesn't exist</p>
        <button
          onClick={() => router.push("/orders")}
          className={styles.primaryBtn}
        >
          Back to Orders
        </button>
      </div>
    );
  }

  return (
    <div className={styles.detailContainer}>
      {/* Header */}
      <div className={styles.detailHeader}>
        <div>
          <div className={styles.headerNav}>
            <button onClick={() => router.back()} className={styles.iconBtn}>
              <ArrowLeft size={18} />
            </button>
            <h1 className={styles.title}>Order #{order.orderNumber}</h1>
            <span className={`${styles.badge} ${getStatusClass()}`}>
              {order?.orderType}
            </span>
            {order?.orderType !== "Cancelled" && (
              <span
                className={`${styles.badge} ${order?.orderCalled === "Called" ? styles.prepaid : styles.cod}`}
              >
                {order?.orderCalled === "Called"
                  ? "Confirmed"
                  : order?.orderStatus}
              </span>
            )}
            <span className={`${styles.badge} ${styles.cod}`}>
              {order?.orderStatus}
            </span>
          </div>
          <p className={styles.subtitle}>
            Placed on {formatDate(order.createdAt)}
          </p>
        </div>
        <div className={styles.headerActions}>
          <button
            onClick={handleDownloadPackingSlip}
            className={styles.secondaryBtn}
          >
            <Printer size={16} />
            Packing Slip 1
          </button>
          <button onClick={handleDownloadSlip2} className={styles.secondaryBtn}>
            <Printer size={16} />
            Packing Slip 2
          </button>
          <Link
            href={`/orders/${orderId}/edit`}
            className={styles.secondaryBtn}
          >
            <Edit size={16} />
            Edit Order
          </Link>
        </div>
      </div>

      {/* Status Bar */}
      <div className={styles.statusBar}>
        <div className={styles.statusInfo}>
          <div className={styles.statusMeta}>
            <Calendar size={16} />
            <span>{formatDate(order.createdAt)}</span>
            <span className={styles.dot}>•</span>
            <Package size={16} />
            <span>{orderItems.length} items</span>
            <span className={styles.dot}>•</span>
            <span className={styles.totalAmount}>
              {formatCurrency(orderFinalAmount)}
            </span>
          </div>
        </div>
        <div className={styles.statusActions}>
          {order.orderStatus !== "Cancelled" && (
            <>
              <button
                onClick={() => handleStatusUpdate("confirm")}
                className={styles.successBtn}
              >
                <Check size={16} />
                Confirm
              </button>
              <button
                onClick={() => setShowTracking(true)}
                className={styles.secondaryBtn}
              >
                <Truck size={16} />
                Tracking
              </button>
              <button
                onClick={() => handleStatusUpdate("cancel")}
                className={styles.dangerBtn}
              >
                <X size={16} />
                Cancel
              </button>
            </>
          )}
          {order.orderStatus === "Cancelled" && (
            <button
              onClick={() => handleStatusUpdate("retrieve")}
              className={styles.successBtn}
            >
              <RotateCcw size={16} />
              Retrieve Order
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === "overview" ? styles.activeTab : ""}`}
          onClick={() => setActiveTab("overview")}
        >
          Overview
        </button>
        <button
          className={`${styles.tab} ${activeTab === "comments" ? styles.activeTab : ""}`}
          onClick={() => setActiveTab("comments")}
        >
          Comments & History
        </button>
      </div>

      {/* Content */}
      {activeTab === "overview" ? (
        <div className={styles.detailGrid}>
          {/* Left Column - Order Items */}
          <div className={styles.detailMain}>
            <div className={styles.card}>
              <h2 className={styles.cardTitle}>Order Items</h2>
              <div className={styles.itemsList}>
                {orderItems.map((item, index) => (
                  <Link
                    key={item?.product?._id}
                    href={`/products/${item?.product?.handle}`}
                  >
                    <div key={index} className={styles.detailItem}>
                      <img
                        src={getProductImageUrl(item?.product)}
                        alt={item.product?.title}
                        className={styles.detailItemImage}
                        onError={handleSlipImageError}
                      />
                      <div className={styles.detailItemInfo}>
                        <h4>{item.product?.title}</h4>
                        <p className={styles.itemSku}>
                          SKU: {item.product?.sku}
                        </p>
                        <div className={styles.itemMeta}>
                          <span className={styles.itemPrice}>
                            ₹{item.product?.price}
                          </span>
                          <span className={styles.itemQty}>
                            Qty: {item.quantity}
                          </span>
                        </div>
                      </div>
                      <div className={styles.detailItemTotal}>
                        ₹{(item.product.price * item.quantity).toFixed(0)}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            <div className={styles.card}>
              <h2 className={styles.cardTitle}>Payment Summary</h2>
              <div className={styles.paymentSummary}>
                <div className={styles.summaryRow}>
                  <span>Subtotal</span>
                  <span>{formatCurrency(orderSubtotal)}</span>
                </div>
                <div className={styles.summaryRow}>
                  <span>Shipping</span>
                  <span>
                    {isFreeShipping
                      ? "FREE"
                      : formatCurrency(orderShippingCost)}
                  </span>
                </div>
                {isFreeShipping && (
                  <p className={styles.summaryNote}>{freeShippingNote}</p>
                )}
                {isCodOrder && (
                  <div className={styles.summaryRow}>
                    <span>COD Charges</span>
                    <span>{formatCurrency(orderCodCharge)}</span>
                  </div>
                )}
                <div className={styles.summaryRow}>
                  <span>Total Discount</span>
                  <span>-{formatCurrency(orderDiscount)}</span>
                </div>
                <div className={styles.summaryTotal}>
                  <span>Total</span>
                  <span>{formatCurrency(orderFinalAmount)}</span>
                </div>
                <div className={styles.paymentMethod}>
                  <CreditCard size={16} />
                  <span>Payment: {order.orderType}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Customer Info + Delhivery */}
          <div className={styles.detailSidebar}>
            <div className={styles.card}>
              <h2 className={styles.cardTitle}>Customer</h2>
              <div className={styles.customerProfile}>
                <div className={styles.customerAvatar}>
                  {shippingInfo.firstname?.charAt(0) || "U"}
                </div>
                <div className={styles.customerDetails}>
                  <h3>
                    {shippingInfo.firstname} {shippingInfo.lastname}
                  </h3>
                  <div className={styles.contactRow}>
                    <Mail size={16} />
                    <span
                      onClick={() =>
                        copyToClipboard(shippingInfo.email || "", "Email")
                      }
                      style={{ cursor: "pointer" }}
                      title="Click to copy email"
                    >
                      {shippingInfo.email || "—"}
                    </span>
                  </div>
                  <div className={styles.contactRow}>
                    <Phone size={16} />
                    <span
                      onClick={() =>
                        copyToClipboard(shippingInfo.phone || "", "Phone")
                      }
                      style={{ cursor: "pointer" }}
                      title="Click to copy phone"
                    >
                      {shippingInfo.phone}
                    </span>
                  </div>
                </div>
              </div>

              <div className={styles.addressSection}>
                <h4>Shipping Address</h4>
                <div className={styles.address}>
                  <MapPin size={14} />
                  <div>
                    <p
                      onClick={() =>
                        copyToClipboard(shippingInfo.address || "", "Address")
                      }
                      style={{ cursor: "pointer" }}
                      title="Click to copy address"
                    >
                      {shippingInfo.address}
                    </p>
                    <p>
                      {shippingInfo.city}, {shippingInfo.state} -{" "}
                      {shippingInfo.pincode}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.card}>
              <h2 className={styles.cardTitle}>Order Actions</h2>
              <div className={styles.actionGrid}>
                <button
                  onClick={() =>
                    handleStatusUpdate(isCodOrder ? "prepaid" : "cod")
                  }
                  className={styles.actionBtn}
                >
                  <CreditCard size={16} />
                  Mark as {isCodOrder ? "Prepaid" : "COD"}
                </button>
                <button
                  onClick={() =>
                    handleStatusUpdate("delivery", {
                      name: order?.shippingInfo?.firstname,
                      ordernumber: order?.orderNumber,
                      email: order?.shippingInfo?.email,
                      orderId: order?._id,
                      arriving: false,
                    })
                  }
                  className={styles.actionBtn}
                >
                  <Truck size={16} />
                  Mark Delivered
                </button>
                <button
                  onClick={() =>
                    handleStatusUpdate("delivery", {
                      name: order?.shippingInfo?.firstname,
                      ordernumber: order?.orderNumber,
                      email: order?.shippingInfo?.email,
                      orderId: order?._id,
                      arriving: true,
                    })
                  }
                  className={styles.actionBtn}
                >
                  <Calendar size={16} />
                  Arriving Today
                </button>
                <button
                  onClick={() => handleStatusUpdate("return")}
                  className={styles.dangerBtn}
                >
                  <RotateCcw size={16} />
                  Return Order
                </button>
              </div>
            </div>

            {/* ─── DELHIVERY PANEL ────────────────────────────────────────── */}
            <DelhiveryPanel
              order={order}
              onTrackingUpdate={handleDelhiveryTrackingUpdate}
            />
            {/* ─────────────────────────────────────────────────────────────── */}

            {/* Manual tracking card (non-Delhivery) — only show if partner is not Delhivery */}
            {trackingInfo?.link && trackingInfo?.partner !== "Delhivery" && (
              <div className={styles.card}>
                <h2 className={styles.cardTitle}>Tracking</h2>
                <div className={styles.trackingInfo}>
                  <p className={styles.trackingPartner}>
                    {trackingInfo.partner}
                  </p>
                  <p className={styles.trackingId}>ID: {tracking.id}</p>
                  <a
                    href={tracking.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.trackingLink}
                  >
                    Track Order →
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className={styles.detailGrid}>
          {/* Comments & History */}
          <div className={styles.detailMain}>
            <div className={styles.card}>
              <h2 className={styles.cardTitle}>Add Comment</h2>
              <div className={styles.commentForm}>
                <textarea
                  placeholder="Write a comment..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className={styles.commentInput}
                  rows={3}
                />
                <button onClick={addComment} className={styles.primaryBtn}>
                  <Send size={16} />
                  Post Comment
                </button>
              </div>
            </div>

            <div className={styles.card}>
              <h2 className={styles.cardTitle}>Comments</h2>
              <div className={styles.timeline}>
                {order.orderComment?.length > 0 ? (
                  order.orderComment.map((comment, index) => (
                    <div key={index} className={styles.timelineItem}>
                      <div className={styles.timelineAvatar}>
                        {comment.name?.charAt(0) || "A"}
                      </div>
                      <div className={styles.timelineContent}>
                        <div className={styles.timelineHeader}>
                          <strong>{comment.name}</strong>
                          <span className={styles.timelineTime}>
                            {formatDate(comment.time)}
                          </span>
                        </div>
                        <p className={styles.timelineText}>{comment.message}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className={styles.emptyState}>
                    <MessageSquare size={24} />
                    <p>No comments yet</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className={styles.detailSidebar}>
            <div className={styles.card}>
              <h2 className={styles.cardTitle}>Order History</h2>
              <div className={styles.history}>
                {order.orderHistory?.length > 0 ? (
                  order.orderHistory
                    .slice()
                    .reverse()
                    .map((history, index) => (
                      <div key={index} className={styles.historyItem}>
                        <div className={styles.historyIcon}>
                          <History size={14} />
                        </div>
                        <div className={styles.historyContent}>
                          <p className={styles.historyMessage}>
                            {history.message}
                          </p>
                          <span className={styles.historyTime}>
                            {formatDate(history.time)}
                          </span>
                        </div>
                      </div>
                    ))
                ) : (
                  <div className={styles.emptyState}>
                    <History size={24} />
                    <p>No history available</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manual Tracking Modal (for non-Delhivery partners) */}
      {showTracking && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h3>Update Tracking Information</h3>
              <button
                onClick={() => setShowTracking(false)}
                className={styles.closeButton}
              >
                <X size={20} />
              </button>
            </div>
            <div className={styles.modalContent}>
              <div className={styles.formGroup}>
                <label>Shipping Partner</label>
                <select
                  value={tracking.partner}
                  onChange={(e) =>
                    setTracking((prev) => ({
                      ...prev,
                      partner: e.target.value,
                    }))
                  }
                >
                  <option value="">Select Partner</option>
                  <option value="DTDC">DTDC</option>
                  <option value="Online Express">Online Express</option>
                  <option value="Ecom Express">Ecom Express</option>
                  <option value="Delhivery">Delhivery</option>
                  <option value="Shree Maruti">Shree Maruti</option>
                  <option value="Indian Post">Indian Post</option>
                </select>
              </div>
              <div className={styles.formGroup}>
                <label>Tracking ID</label>
                <input
                  type="text"
                  value={tracking.id}
                  onChange={(e) =>
                    setTracking((prev) => ({ ...prev, id: e.target.value }))
                  }
                  placeholder="Enter tracking ID"
                />
              </div>
              <div className={styles.formGroup}>
                <label>Tracking Link</label>
                <input
                  type="text"
                  value={tracking.link}
                  onChange={(e) =>
                    setTracking((prev) => ({ ...prev, link: e.target.value }))
                  }
                  placeholder="Enter tracking URL"
                />
              </div>
            </div>
            <div className={styles.modalActions}>
              <button
                onClick={() => setShowTracking(false)}
                className={styles.secondaryButton}
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  handleStatusUpdate("tracking", {
                    partner: tracking.partner,
                    link: `TrackingId: ${tracking.id}, Tracking Link: ${tracking.link}`,
                  })
                }
                className={styles.primaryButton}
                disabled={!tracking.partner || !tracking.id}
              >
                Update Tracking
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Packing Slip (hidden, for PDF export) */}
      <div id="packing-slip" className={styles.pdfExportContainer}>
        <div className={styles.packingSlip} ref={targetRef}>
          <div className={styles.packingHeader}>
            <div className={styles.brandSection}>
              <h2>UnMe Jewels</h2>
              <p className={styles.brandSubtitle}>by divyam basics studio</p>
            </div>
            <div className={styles.orderMeta}>
              <div className={styles.orderNumber}>#{order.orderNumber}</div>
              <div className={styles.orderDate}>
                {new Date(order.createdAt).toLocaleDateString("en-IN")}
              </div>
              <span
                className={`${styles.statusBadge} ${
                  isCodOrder ? styles.cod : isPrepaidOrder ? styles.paid : ""
                }`}
              >
                {isCodOrder
                  ? "COD"
                  : isPrepaidOrder
                    ? "PREPAID"
                    : order.orderStatus}
              </span>
            </div>
          </div>

          <div className={styles.packingAddressGrid}>
            <div className={styles.addressColumn}>
              <h4>FROM</h4>
              <div className={styles.storeAddress}>
                <strong>UnMe Jewels</strong>
                <div>G-65, Sector 63, Noida</div>
                <div>Uttar Pradesh - 201301</div>
                <div>GSTIN: IN09AAXFD9660L1ZD</div>
                <div className={styles.contactRow}>
                  <Phone size={10} />
                  <span>+91 9891565936</span>
                </div>
              </div>
            </div>

            <div className={styles.addressColumn}>
              <h4>SHIP TO</h4>
              <div className={styles.customerDetails}>
                <div className={styles.customerName}>
                  {shippingInfo.firstname} {shippingInfo.lastname}
                </div>
                <div>{shippingInfo.address}</div>
                <div>
                  {shippingInfo.city}, {shippingInfo.state} -{" "}
                  {shippingInfo.pincode}
                </div>
                <div className={styles.contactRow}>
                  <Phone size={10} />
                  <span>{shippingInfo.phone}</span>
                </div>
              </div>
            </div>
          </div>

          <div className={styles.packingItemsTable}>
            <div className={styles.packingTableHeader}>
              <div></div>
              <div>Item</div>
              <div className={styles.packingCellRight}>Price</div>
              <div className={styles.packingCellRight}>Qty</div>
              <div className={styles.packingCellRight}>Total</div>
            </div>

            {orderItems.map((item, index) => (
              <div key={index} className={styles.packingTableRow}>
                <div>
                  <img
                    src={getSlipImageUrl(item?.product)}
                    alt={item.product?.title}
                    className={styles.packingProductImage}
                    onError={handleSlipImageError}
                  />
                </div>
                <div>
                  <p className={styles.packingProductTitle}>
                    {item.product?.title}
                  </p>
                  <p className={styles.packingProductSku}>
                    SKU: {item.product?.sku}
                  </p>
                </div>
                <div className={styles.packingCellRight}>
                  ₹{item.product?.price}
                </div>
                <div className={styles.packingCellRight}>
                  <span className={styles.packingQuantity}>
                    {item.quantity}
                  </span>
                </div>
                <div className={styles.packingCellRight}>
                  <span className={styles.packingTotalPrice}>
                    ₹{(item.product.price * item.quantity).toFixed(0)}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className={styles.packingSummary}>
            <div className={styles.packingSummaryBox}>
              <div className={styles.packingSummaryRow}>
                <span>Subtotal</span>
                <span>{formatCurrency(orderSubtotal)}</span>
              </div>
              <div className={styles.packingSummaryRow}>
                <span>Shipping</span>
                <span>
                  {isFreeShipping ? "FREE" : formatCurrency(orderShippingCost)}
                </span>
              </div>
              {isCodOrder && (
                <div className={styles.packingSummaryRow}>
                  <span>COD Charges</span>
                  <span>{formatCurrency(orderCodCharge)}</span>
                </div>
              )}
              <div className={styles.packingSummaryRow}>
                <span>Total Discount</span>
                <span>-{formatCurrency(orderDiscount)}</span>
              </div>
              <div className={styles.packingSummaryTotal}>
                <span>Total</span>
                <span>
                  {formatCurrency(orderFinalAmount)}
                  <span
                    className={`${styles.paymentStatus} ${
                      isPrepaidOrder ? styles.paid : styles.cod
                    }`}
                  >
                    {isPrepaidOrder ? "PAID" : "COD"}
                  </span>
                </span>
              </div>
            </div>
          </div>

          <div className={styles.packingThankYou}>
            <p className={styles.thankYouText}>
              <strong>Thank you, {shippingInfo.firstname}!</strong> We hope you
              love your jewelry.
            </p>
            <p className={styles.returnPolicy}>
              <RotateCcw size={10} /> 7-day Exchange
            </p>
          </div>

          <div className={styles.packingFooter}>
            <div className={styles.footerLeft}>
              <span className={styles.footerIcon}>
                <Check size={10} /> Handcrafted in India
              </span>
            </div>
            <div className={styles.footerRight}>
              <span className={styles.footerIcon}>
                <Mail size={10} /> unmejewels@gmail.com
              </span>
              <span className={styles.footerIcon}>
                <Calendar size={10} />{" "}
                {new Date(order.createdAt).toLocaleDateString("en-IN")}
              </span>
            </div>
          </div>
        </div>
      </div>
      {/* Hidden Slip 2 */}
      <div id="order-slip-2" className={styles.pdfExportContainer}>
        <div className={styles.orderSlip2} ref={targetRef2}>
          <div className={styles.slip2TopBar}>
            <div className={styles.slip2OrderNo}>
              ORDER NO: {order.orderNumber}
            </div>
            <div
              className={`${styles.slip2PaymentMode} ${isCodOrder ? styles.cod : styles.prepaid}`}
            >
              {isCodOrder ? "COD" : "PREPAID"}
            </div>
          </div>

          <div className={styles.slip2HighlightBox}>
            <div className={styles.slip2CustomerName}>
              {shippingInfo.firstname?.toUpperCase()}{" "}
              {shippingInfo.lastname?.toUpperCase()}
            </div>
            <div className={styles.slip2CustomerPhone}>
              +91 {shippingInfo.phone}
            </div>
          </div>

          <div className={styles.slip2Details}>
            <div className={styles.slip2DetailRow}>
              <div className={styles.slip2Label}>Amount:</div>
              <div className={styles.slip2Label}>Rs. {orderFinalAmount}</div>
            </div>
            <div className={styles.slip2DetailRow}>
              <div className={styles.slip2Label}>Address:</div>
              <div className={styles.slip2Value}>{shippingInfo.address}</div>
            </div>
            <div className={styles.slip2DetailRow}>
              <div className={styles.slip2Label}>Pincode:</div>
              <div className={styles.slip2Value}>{shippingInfo.pincode}</div>
            </div>
            <div className={styles.slip2DetailRow}>
              <div className={styles.slip2Label}>State:</div>
              <div className={styles.slip2Value}>{shippingInfo.state}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
