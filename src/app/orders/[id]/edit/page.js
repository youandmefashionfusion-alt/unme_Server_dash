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

  const { formData, totals, setSearch, updateShippingInfo, updateOrderSetting, addProduct, updateQuantity, removeProduct, validate } = useOrderForm();

  useEffect(() => {
    fetchOrder();
  }, [orderId]);

  const fetchOrder = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/order/single-order?id=${orderId}`);
      const data = await res.json();

      if (res.ok && data) {
        setOriginalOrder(data);
        // Initialize form with existing order data
        updateShippingInfo('firstname', data.shippingInfo.firstname || '');
        updateShippingInfo('lastname', data.shippingInfo.lastname || '');
        updateShippingInfo('email', data.shippingInfo.email || '');
        updateShippingInfo('phone', String(data.shippingInfo.phone || ''))
        updateShippingInfo('address', data.shippingInfo.address || '');
        updateShippingInfo('city', data.shippingInfo.city || '');
        updateShippingInfo('state', data.shippingInfo.state || '');
        updateShippingInfo('pincode', String(data.shippingInfo.pincode || ''))

        // Add products one by one
        if (data.orderItems?.length > 0) {
          data?.orderItems?.forEach(item => {
            addProduct(item.product);
            // Update quantity after product is added
            setTimeout(() => {
              const index = formData?.orderItems?.length;
              updateQuantity(index, item.quantity);
            }, 0);
          });
        }

        updateOrderSetting('orderType', data.orderType || 'COD');
        updateOrderSetting('discount', Number(data.discount) || 0);
        updateOrderSetting('shippingCost', Number(data.shippingCost) || 0);
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
          orderItems: formData.orderItems,
          totalPrice: totals.subtotal,
          shippingCost: formData.shippingCost,
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
    const urlParts = url.split('/upload/');
    return `${urlParts[0]}/upload/c_limit,h_300,f_auto,q_60/${urlParts[1]}`;
  };

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner}></div>
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
              <div className={styles.summaryRow}>
                <span>Discount</span>
                <span>-₹{formData.discount}</span>
              </div>
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