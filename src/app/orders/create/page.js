'use client';
import { useRouter } from 'next/navigation';
import { Save, ArrowLeft } from 'lucide-react';
import { useOrderForm } from '../../../../controller/useOrderForm';
import ProductSearch from '../../../../components/ProductSearch';
import styles from '../orders.module.css';
import toast from 'react-hot-toast';

const toPaise = (value) => Math.max(Math.round((Number(value) || 0) * 100), 0);

const buildRazorpayLineItems = (items = []) => {
  if (!Array.isArray(items)) return [];

  return items
    .map((item, index) => {
      const product = item?.product || {};
      const quantity = Math.max(Number(item?.quantity) || 1, 1);
      const unitPricePaise = toPaise(product?.price);

      if (!unitPricePaise) return null;

      const safeSku = String(product?.sku || `sku-${index + 1}`).slice(0, 64);
      const safeName = String(product?.title || 'Product').slice(0, 255);
      const safeDescription = String(product?.title || 'Dashboard order item').slice(0, 255);
      const productUrl = product?.handle
        ? `https://unmejewels.com/products/${product.handle}`
        : undefined;
      const imageUrl =
        product?.images?.[0]?.url ||
        product?.images?.[0]?.secure_url ||
        product?.images?.[0]?.src ||
        undefined;

      return {
        sku: safeSku,
        variant_id: String(product?._id || safeSku).slice(0, 64),
        price: unitPricePaise,
        offer_price: unitPricePaise,
        quantity,
        name: safeName,
        description: safeDescription,
        ...(productUrl ? { product_url: productUrl } : {}),
        ...(imageUrl ? { image_url: imageUrl } : {}),
      };
    })
    .filter(Boolean);
};

export default function CreateOrderPage() {
  const router = useRouter();
  const {
    formData,
    totals,
    updateShippingInfo,
    updateOrderSetting,
    addProduct,
    updateQuantity,
    updateOrderItem,
    removeProduct,
    validate,
  } = useOrderForm();

  const handleSubmit = async () => {
    if (!validate()) return;

    try {
      const orderItemsPayload = formData.orderItems.map((item) => ({
        product: item?.product?._id,
        quantity: item?.quantity,
        price: item?.product?.price,
        isGift: Boolean(item?.isGift),
        giftWrap: Boolean(item?.giftWrap),
        giftWrapCharge: item?.giftWrap ? Number(item?.giftWrapCharge || 69) : 0,
        giftMessage: item?.isGift ? String(item?.giftMessage || '') : '',
      }));

      const basePayload = {
        ...formData,
        orderItems: orderItemsPayload,
        codCharge: formData.orderType === 'COD' ? Number(formData.codCharge || 0) : 0,
        totalPrice: totals.subtotal,
        giftWrapTotal: totals.giftWrapTotal,
        finalAmount: totals.total,
      };

      let orderPayload = { ...basePayload };

      if (formData.orderType === 'Prepaid') {
        const lineItems = buildRazorpayLineItems(formData.orderItems);
        const lineItemsTotalPaise = lineItems.reduce(
          (sum, item) => sum + Number(item.offer_price || 0) * Number(item.quantity || 1),
          0
        );

        const razorpayResponse = await fetch('/api/razorpay/create-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: totals.total,
            currency: 'INR',
            receipt: `dash_${Date.now()}`,
            notes: {
              source: 'dashboard',
              flow: 'orders-create',
              customerPhone: String(formData?.shippingInfo?.phone || ''),
            },
            line_items_total: lineItemsTotalPaise,
            line_items: lineItems,
          }),
        });

        const razorpayData = await razorpayResponse.json().catch(() => ({}));
        if (!razorpayResponse.ok || !razorpayData?.success || !razorpayData?.order?.id) {
          throw new Error(razorpayData?.message || 'Failed to create Razorpay order');
        }

        const razorpayAmountPaise = Number(razorpayData?.order?.amount) || 0;
        const resolvedFinalAmount = Number((razorpayAmountPaise / 100).toFixed(2));

        orderPayload = {
          ...basePayload,
          finalAmount: resolvedFinalAmount > 0 ? resolvedFinalAmount : totals.total,
          paymentInfo: {
            razorpayOrderId: razorpayData.order.id,
            razorpayPaymentId: razorpayData.order.id,
            paymentId: razorpayData.order.id,
            razorpayAmountPaise,
            lineItemsTotalPaise: Number(razorpayData?.order?.line_items_total || 0),
            currency: razorpayData?.order?.currency || 'INR',
            receipt: razorpayData?.order?.receipt || '',
          },
        };
      } else {
        orderPayload = {
          ...basePayload,
          paymentInfo: {
            razorpayOrderId: 'COD',
            razorpayPaymentId: 'COD',
            paymentId: 'COD',
          },
        };
      }

      const res = await fetch('/api/order/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayload),
      });

      if (res.ok) {
        toast.success('Order created');
        router.push('/orders');
      } else {
        const errorData = await res.json().catch(() => ({}));
        toast.error(errorData?.error || errorData?.message || 'Creation failed');
      }
    } catch (error) {
      toast.error(error?.message || 'Something went wrong');
    }
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Create Order</h1>
          <p className={styles.subtitle}>Add products and customer details</p>
        </div>
        <div className={styles.headerActions}>
          <button onClick={() => router.back()} className={styles.secondaryBtn}>
            <ArrowLeft size={18} />
            Back
          </button>
          <button onClick={handleSubmit} className={styles.primaryBtn}>
            <Save size={18} />
            Create Order
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
              {formData.orderItems.map((item, index) => (
                <div key={index} className={styles.selectedItem}>
                  <img 
                    src={item.product.images?.[0]?.url || '/placeholder.jpg'} 
                    alt={item.product.title}
                    className={styles.selectedImage}
                  />
                  <div className={styles.selectedInfo}>
                    <h4>{item.product.title}</h4>
                    <p>SKU: {item.product.sku}</p>
                    <span className={styles.price}>₹{item.product.price}</span>
                  </div>
                  <div className={styles.selectedControls}>
                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => updateQuantity(index, e.target.value)}
                      className={styles.qtyInput}
                    />
                    <span className={styles.itemTotal}>₹{item.product.price * item.quantity}</span>
                    <button 
                      onClick={() => removeProduct(index)}
                      className={styles.removeBtn}
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
              ))}
              {formData.orderItems.length === 0 && (
                <div className={styles.emptyProducts}>
                  <p>No products added</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Customer & Payment */}
        <div className={styles.column}>
          {/* Customer Details */}
          <div className={styles.card}>
            <h2 className={styles.sectionTitle}>Customer</h2>
            <div className={styles.formGrid}>
              <div className={styles.field}>
                <label>Name *</label>
                <input
                  type="text"
                  value={formData.shippingInfo.firstname}
                  onChange={(e) => updateShippingInfo('firstname', e.target.value)}
                  placeholder="First name"
                />
              </div>
              <div className={styles.field}>
                <label>Last Name</label>
                <input
                  type="text"
                  value={formData.shippingInfo.lastname}
                  onChange={(e) => updateShippingInfo('lastname', e.target.value)}
                  placeholder="Last name"
                />
              </div>
              <div className={styles.field}>
                <label>Email</label>
                <input
                  type="email"
                  value={formData.shippingInfo.email}
                  onChange={(e) => updateShippingInfo('email', e.target.value)}
                  placeholder="customer@example.com"
                />
              </div>
              <div className={styles.field}>
                <label>Phone *</label>
                <input
                  type="tel"
                  value={formData.shippingInfo.phone}
                  onChange={(e) => updateShippingInfo('phone', e.target.value)}
                  placeholder="10-digit number"
                />
              </div>
              <div className={styles.fieldFull}>
                <label>Address</label>
                <input
                  type="text"
                  value={formData.shippingInfo.address}
                  onChange={(e) => updateShippingInfo('address', e.target.value)}
                  placeholder="Street address"
                />
              </div>
              <div className={styles.field}>
                <label>City</label>
                <input
                  type="text"
                  value={formData.shippingInfo.city}
                  onChange={(e) => updateShippingInfo('city', e.target.value)}
                />
              </div>
              <div className={styles.field}>
                <label>State</label>
                <input
                  type="text"
                  value={formData.shippingInfo.state}
                  onChange={(e) => updateShippingInfo('state', e.target.value)}
                />
              </div>
              <div className={styles.field}>
                <label>PIN Code</label>
                <input
                  type="text"
                  value={formData.shippingInfo.pincode}
                  onChange={(e) => updateShippingInfo('pincode', e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Payment */}
          <div className={styles.card}>
            <h2 className={styles.sectionTitle}>Payment</h2>
            <div className={styles.paymentGrid}>
              <div className={styles.field}>
                <label>Order Type</label>
                <select
                  value={formData.orderType}
                  onChange={(e) => updateOrderSetting('orderType', e.target.value)}
                >
                  <option value="COD">Cash on Delivery</option>
                  <option value="Prepaid">Prepaid</option>
                </select>
              </div>
              <div className={styles.field}>
                <label>Shipping (₹)</label>
                <input
                  type="number"
                  value={formData.shippingCost}
                  onChange={(e) => updateOrderSetting('shippingCost', Number(e.target.value) || 0)}
                  min="0"
                />
              </div>
              <div className={styles.field}>
                <label>Discount (₹)</label>
                <input
                  type="number"
                  value={formData.discount}
                  onChange={(e) => updateOrderSetting('discount', Number(e.target.value) || 0)}
                  min="0"
                />
              </div>
              <div className={styles.field}>
                <label>COD Charges (Rs)</label>
                <input
                  type="number"
                  value={formData.codCharge}
                  onChange={(e) => updateOrderSetting('codCharge', Number(e.target.value) || 0)}
                  min="0"
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
                <span>+₹{formData.shippingCost}</span>
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
