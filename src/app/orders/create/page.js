'use client';
import { useRouter } from 'next/navigation';
import { useSelector } from 'react-redux';
import { Save, ArrowLeft } from 'lucide-react';
import { useOrderForm } from '../../../../controller/useOrderForm';
import ProductSearch from '../../../../components/ProductSearch';
import styles from '../orders.module.css';
import toast from 'react-hot-toast';

export default function CreateOrderPage() {
  const router = useRouter();
  const { user } = useSelector((state) => state.auth);
  const { formData, totals, setSearch, updateShippingInfo, updateOrderSetting, addProduct, updateQuantity, removeProduct, validate } = useOrderForm();

  const handleSubmit = async () => {
    if (!validate()) return;

    try {
      const res = await fetch('/api/order/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          codCharge: formData.orderType === 'COD' ? Number(formData.codCharge || 0) : 0,
          totalPrice: totals.subtotal,
          finalAmount: totals.total,
        }),
      });

      if (res.ok) {
        toast.success('Order created');
        router.push('/orders');
      } else {
        toast.error('Creation failed');
      }
    } catch (error) {
      toast.error('Something went wrong');
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
