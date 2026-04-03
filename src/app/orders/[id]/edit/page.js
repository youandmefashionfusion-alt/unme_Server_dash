'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSelector } from 'react-redux';
import { Save, ArrowLeft } from 'lucide-react';
import { useOrderForm } from '../../../../../controller/useOrderForm';
import ProductSearch from '../../../../../components/ProductSearch';
import styles from '../../orders.module.css';
import toast from 'react-hot-toast';

export default function EditOrderPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.id;
  const { user } = useSelector((state) => state.auth);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [originalOrder, setOriginalOrder] = useState(null);

  const {
    formData,
    totals,
    updateShippingInfo,
    updateOrderSetting,
    replaceFromOrder,
    addProduct,
    updateQuantity,
    updateOrderItem,
    removeProduct,
    validate,
  } = useOrderForm();

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
      const orderPayload = data?.order && typeof data.order === 'object' ? data.order : data;
      const hasValidOrder = Boolean(orderPayload && typeof orderPayload === 'object' && orderPayload._id);

      if (res.ok && hasValidOrder) {
        setOriginalOrder(orderPayload);
        replaceFromOrder(orderPayload);
      } else {
        toast.error('Order not found');
        router.push('/orders');
      }
    } catch (error) {
      toast.error('Failed to load order');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    if (!user?.token) {
      toast.error('Authentication required');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/order/update-order?id=${orderId}&token=${user.token}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shippingInfo: formData.shippingInfo,
          orderItems: formData.orderItems.map((item) => ({
            product: item?.product?._id,
            quantity: item?.quantity,
            price: item?.product?.price,
            isGift: Boolean(item?.isGift),
            giftWrap: Boolean(item?.giftWrap),
            giftWrapCharge: item?.giftWrap ? Number(item?.giftWrapCharge || 69) : 0,
            giftMessage: item?.isGift ? String(item?.giftMessage || '') : '',
          })),
          totalPrice: totals.subtotal,
          giftWrapTotal: totals.giftWrapTotal,
          shippingCost: formData.shippingCost,
          codCharge: formData.orderType === 'COD' ? formData.codCharge : 0,
          orderType: formData.orderType,
          discount: formData.discount,
          finalAmount: totals.total,
        }),
      });

      if (res.ok) {
        // Create history record
        await fetch('/api/order/set-history', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId,
            name: user?.firstname,
            time: new Date(),
            message: `Order edited by ${user?.firstname}`,
          }),
        });

        toast.success('Order updated successfully');
        router.push(`/orders/${orderId}`);
      } else {
        toast.error('Failed to update order');
      }
    } catch (error) {
      toast.error('Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  const modifyCloudinaryUrl = (url) => {
    if (!url) return '/placeholder-image.jpg';
    const cloudfront = process.env.NEXT_PUBLIC_CLOUDFRONT_URL || 'https://d2gtpgxs0y565n.cloudfront.net';
    
    // Check if it's an S3 URL - convert to CloudFront
    if (url.includes('s3.') || url.includes('amazonaws.com')) {
      try {
        const urlObj = new URL(url);
        const pathname = urlObj.pathname;
        return `${cloudfront}${pathname}`;
      } catch (e) {
        return url;
      }
    }
    
    // Apply Cloudinary transformations for Cloudinary URLs
    const urlParts = url.split('/upload/');
    if (urlParts.length === 2) {
      return `${urlParts[0]}/upload/c_limit,h_300,f_auto,q_60/${urlParts[1]}`;
    }
    return url;
  };

  if (loading) {
    return (
      <div className={styles.loading}>
        <lottie-player src="/Loader-cat.json" background="transparent" speed="1" loop autoplay aria-label="Loading" style={{ width: 200, height: 200, display: "inline-block" }} />
        <p>Loading order...</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Edit Order</h1>
          <p className={styles.subtitle}>
            #{originalOrder?.orderNumber} • Updating order details
          </p>
        </div>
        <div className={styles.headerActions}>
          <button
            onClick={() => router.back()}
            className={styles.secondaryBtn}
            disabled={saving}
          >
            <ArrowLeft size={18} />
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className={styles.primaryBtn}
            disabled={saving}
          >
            <Save size={18} />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      <div className={styles.twoColumn}>
        {/* Left: Products */}
        <div className={styles.column}>
          <div className={styles.card}>
            <h2 className={styles.sectionTitle}>Products</h2>
            <ProductSearch onAddProduct={addProduct} />

            <div className={styles.selectedProducts}>
              <h3>Order Items ({formData.orderItems.length})</h3>
              {formData.orderItems.length > 0 ? (
                formData.orderItems.map((item, index) => (
                  <div key={index} className={styles.orderItem}>
                    <img
                      src={modifyCloudinaryUrl(item.product.images?.[0]?.url)}
                      alt={item.product.title}
                      className={styles.itemImage}
                    />
                    <div className={styles.itemDetails}>
                      <h4>{item.product.title}</h4>
                      <p>SKU: {item.product.sku}</p>
                      <p className={styles.itemPrice}>₹{item.product.price} each</p>
                    </div>
                    <div className={styles.itemControls}>
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => updateQuantity(index, e.target.value)}
                        className={styles.quantityInput}
                      />
                      <p className={styles.itemTotal}>₹{item.product.price * item.quantity}</p>
                      <button
                        onClick={() => removeProduct(index)}
                        className={styles.removeButton}
                      >
                        ✕
                      </button>
                    </div>
                    <div className={styles.itemGiftControls}>
                      <label className={styles.itemCheckboxLabel}>
                        <input
                          type="checkbox"
                          checked={Boolean(item.giftWrap)}
                          onChange={(e) =>
                            updateOrderItem(index, { giftWrap: e.target.checked })
                          }
                        />
                        Gift wrap (+Rs {item.giftWrap ? item.giftWrapCharge : 69} order-level)
                      </label>
                      <label className={styles.itemCheckboxLabel}>
                        <input
                          type="checkbox"
                          checked={Boolean(item.isGift)}
                          onChange={(e) =>
                            updateOrderItem(index, { isGift: e.target.checked })
                          }
                        />
                        Mark as gift
                      </label>
                      {item.isGift && (
                        <textarea
                          rows={2}
                          maxLength={180}
                          value={item.giftMessage || ''}
                          onChange={(e) =>
                            updateOrderItem(index, { giftMessage: e.target.value })
                          }
                          placeholder="Gift message (max 180 chars)"
                          className={styles.itemGiftTextarea}
                        />
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className={styles.emptyProducts}>
                  <p>No products in this order</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Customer & Payment */}
        <div className={styles.column}>
          {/* Customer Details */}
          <div className={styles.card}>
            <h2 className={styles.sectionTitle}>Customer Details</h2>
            <div className={styles.formGrid}>
              <div className={styles.formGroup}>
                <label>First Name *</label>
                <input
                  type="text"
                  value={formData?.shippingInfo?.firstname}
                  onChange={(e) => updateShippingInfo('firstname', e.target.value)}
                  placeholder="First name"
                />
              </div>
              <div className={styles.formGroup}>
                <label>Last Name</label>
                <input
                  type="text"
                  value={formData?.shippingInfo?.lastname}
                  onChange={(e) => updateShippingInfo('lastname', e.target.value)}
                  placeholder="Last name"
                />
              </div>
              <div className={styles.formGroup}>
                <label>Email</label>
                <input
                  type="email"
                  value={formData?.shippingInfo?.email}
                  onChange={(e) => updateShippingInfo('email', e.target.value)}
                  placeholder="Email address"
                />
              </div>
              <div className={styles?.formGroup}>
                <label>Phone *</label>
                <input
                  type="tel"
                  value={formData?.shippingInfo?.phone || ''}
                  onChange={(e) => updateShippingInfo('phone', e.target.value)}
                  placeholder="Phone number"
                />
              </div>
              <div className={styles.formGroup}>
                <label>Address</label>
                <input
                  type="text"
                  value={formData?.shippingInfo?.address}
                  onChange={(e) => updateShippingInfo('address', e.target.value)}
                  placeholder="Address"
                />
              </div>
              <div className={styles.formGroup}>
                <label>City</label>
                <input
                  type="text"
                  value={formData.shippingInfo.city}
                  onChange={(e) => updateShippingInfo('city', e.target.value)}
                  placeholder="City"
                />
              </div>
              <div className={styles.formGroup}>
                <label>State</label>
                <input
                  type="text"
                  value={formData.shippingInfo.state}
                  onChange={(e) => updateShippingInfo('state', e.target.value)}
                  placeholder="State"
                />
              </div>
              <div className={styles.formGroup}>
                <label>PIN Code</label>
                <input
                  type="text"
                  value={formData.shippingInfo.pincode}
                  onChange={(e) => updateShippingInfo('pincode', e.target.value)}
                  placeholder="PIN code"
                />
              </div>
            </div>
          </div>

          {/* Order Settings */}
          <div className={styles.card}>
            <h2 className={styles.sectionTitle}>Order Settings</h2>
            <div className={styles.formGrid}>
              <div className={styles.formGroup}>
                <label>Order Type</label>
                <select
                  value={formData.orderType}
                  onChange={(e) => updateOrderSetting('orderType', e.target.value)}
                >
                  <option value="COD">Cash on Delivery</option>
                  <option value="Prepaid">Prepaid</option>
                </select>
              </div>
              <div className={styles.formGroup}>
                <label>Shipping Cost (₹)</label>
                <input
                  type="number"
                  value={formData.shippingCost}
                  onChange={(e) => updateOrderSetting('shippingCost', parseFloat(e.target.value) || 0)}
                  placeholder="Shipping cost"
                />
              </div>
              <div className={styles.formGroup}>
                <label>Discount (₹)</label>
                <input
                  type="number"
                  value={formData.discount}
                  onChange={(e) => updateOrderSetting('discount', parseFloat(e.target.value) || 0)}
                  placeholder="Discount amount"
                />
              </div>
              <div className={styles.formGroup}>
                <label>COD Charges (Rs)</label>
                <input
                  type="number"
                  min="0"
                  value={formData.codCharge}
                  onChange={(e) => updateOrderSetting('codCharge', parseFloat(e.target.value) || 0)}
                  placeholder="COD charges"
                  disabled={formData.orderType !== 'COD'}
                />
              </div>
            </div>

            <div className={styles.summary}>
              <div className={styles.summaryRow}>
                <span>Subtotal</span>
                <span>₹{totals.subtotal}</span>
              </div>
              <div className={styles.summaryRow}>
                <span>Shipping</span>
                <span>₹{formData.shippingCost}</span>
              </div>
              {totals.giftWrapTotal > 0 && (
                <div className={styles.summaryRow}>
                  <span>Gift Wrap (Order Level)</span>
                  <span>+₹{totals.giftWrapTotal}</span>
                </div>
              )}
              <div className={styles.summaryRow}>
                <span>Discount</span>
                <span>-₹{formData.discount}</span>
              </div>
              {formData.orderType === 'COD' && (
                <div className={styles.summaryRow}>
                  <span>COD Charges</span>
                  <span>+Rs {formData.codCharge}</span>
                </div>
              )}
              <div className={styles.summaryTotal}>
                <span>Total</span>
                <span>₹{totals.total}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}



