'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSelector } from 'react-redux';
import styles from '../../orders/orders.module.css';
import {
  ArrowLeft,
  Calendar,
  Mail,
  Phone,
  MapPin,
  Edit,
  Trash2,
  PhoneCall,
  PhoneOff,
  ShoppingCart,
  Save,
  User
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import toast from 'react-hot-toast';

const SingleAbandonedPage = () => {
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const user = useSelector((state) => state.auth.user);
  
  const params = useParams();
  const router = useRouter();
  const orderId = params.id;

  const [formData, setFormData] = useState({
    firstname: '',
    lastname: '',
    email: '',
    phone: '',
    mobile: '',
    address: '',
    city: '',
    state: '',
    pincode: ''
  });

  const fetchOrder = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/abandoned/single-abandoned?id=${orderId}`);
      const data = await response.json();
      
      if (response.ok) {
        setOrder(data);
        setFormData({
          firstname: data.shippingInfo?.firstname || '',
          lastname: data.shippingInfo?.lastname || '',
          email: data.shippingInfo?.email || '',
          phone: data.shippingInfo?.phone || '',
          mobile: data.shippingInfo?.mobile || '',
          address: data.shippingInfo?.address || '',
          city: data.shippingInfo?.city || '',
          state: data.shippingInfo?.state || '',
          pincode: data.shippingInfo?.pincode || ''
        });
      } else {
        throw new Error(data.message || 'Failed to fetch order');
      }
    } catch (error) {
      console.error('Error fetching order:', error);
      toast.error('Failed to load abandoned order');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (orderId) {
      fetchOrder();
    }
  }, [orderId]);

  const createHistory = async (data) => {
    try {
      await fetch('/api/history/create-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
    } catch (error) {
      console.error('Error creating history:', error);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const updateOrder = async () => {
    try {
      setSaving(true);
      const response = await fetch(`/api/abandoned/update-abandoned?id=${orderId}&token=${user?.token}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shippingInfo: formData,
          orderItems: order.orderItems,
          totalPrice: order.totalPrice,
          shippingCost: order.shippingCost,
          orderType: order.orderType,
          discount: order.discount,
          finalAmount: order.finalAmount,
          orderNumber: order.orderNumber,
          orderCalled: order.orderCalled,
        }),
      });

      if (response.ok) {
        toast.success('Order updated successfully');
        await createHistory({
          name: user?.firstname,
          title: 'Abandoned Updated',
          sku: '',
          productchange: `For #${order.orderNumber}`,
          time: new Date().toISOString(),
        });
        setIsEditing(false);
        fetchOrder();
      } else {
        throw new Error('Failed to update order');
      }
    } catch (error) {
      console.error('Error updating order:', error);
      toast.error('Failed to update order');
    } finally {
      setSaving(false);
    }
  };

  const markAsCalled = async (type) => {
    try {
      const response = await fetch(`/api/abandoned/called-abandoned?id=${orderId}&type=${type}&token=${user?.token}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        const action = type === 'Called' ? 'marked as called' : 'marked as not picked';
        toast.success(`Order ${action} successfully`);
        
        await createHistory({
          name: user?.firstname,
          title: `Abandoned ${type === 'Called' ? 'Mark as Called' : 'Mark as Not Picked'}`,
          sku: '',
          productchange: `For #${order.orderNumber}`,
          time: new Date().toISOString(),
        });
        
        fetchOrder();
      } else {
        throw new Error('Failed to update order status');
      }
    } catch (error) {
      console.error('Error updating order status:', error);
      toast.error('Failed to update order status');
    }
  };

  const deleteOrder = async () => {
    if (!window.confirm('Are you sure you want to delete this abandoned order?')) {
      return;
    }

    try {
      const response = await fetch(`/api/abandoned/delete-abandoned?id=${orderId}&token=${user?.token}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        toast.success('Abandoned order deleted successfully');
        
        await createHistory({
          name: user?.firstname,
          title: 'Abandoned Deleted',
          sku: '',
          productchange: `For #${order.orderNumber}`,
          time: new Date().toISOString(),
        });
        
        router.push('/abandoned');
      } else {
        throw new Error('Failed to delete order');
      }
    } catch (error) {
      console.error('Error deleting order:', error);
      toast.error('Failed to delete order');
    }
  };

  const createOrderFromAbandoned = async () => {
    if (!window.confirm('Create a new order from this abandoned cart?')) {
      return;
    }

    try {
      const response = await fetch('/api/order/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shippingInfo: formData,
          paymentInfo: {
            razorpayOrderId: 'COD',
            razorpayPaymentId: 'COD',
          },
          orderItems: order.orderItems,
          totalPrice: order.totalPrice,
          shippingCost: order.shippingCost,
          orderType: 'COD',
          discount: order.discount,
          finalAmount: order.finalAmount,
        }),
      });

      if (response.ok) {
        toast.success('Order created successfully');
        
        await createHistory({
          name: user?.firstname,
          title: 'Order Created from Abandoned',
          sku: '',
          productchange: `For ${formData.firstname}, Amount:${order.finalAmount}, orderType:COD Number:${order.orderNumber}, Items:${order.orderItems?.length}`,
          time: new Date().toISOString(),
        });
        
        router.push('/abandoned');
      } else {
        throw new Error('Failed to create order');
      }
    } catch (error) {
      console.error('Error creating order:', error);
      toast.error('Failed to create order');
    }
  };

  const modifyCloudinaryUrl = (url) => {
    if (!url) return '';
    const urlParts = url.split('/upload/');
    return `${urlParts[0]}/upload/c_limit,h_300,f_auto,q_60/${urlParts[1]}`;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Called': return '#10b981';
      case 'notpicked': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'Called': return 'Called';
      case 'notpicked': return 'Not Picked';
      default: return 'Pending';
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner}></div>
        <p>Loading abandoned order...</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className={styles.error}>
        <h2>Order Not Found</h2>
        <p>The abandoned order you're looking for doesn't exist.</p>
        <Link href="/abandoned" className={styles.primaryBtn}>
          <ArrowLeft size={16} />
          Back to Abandoned Orders
        </Link>
      </div>
    );
  }

  const subtotal = order.orderItems?.reduce((sum, item) => sum + (item.quantity * item.price), 0) || 0;

  return (
    <div className={styles.detailContainer}>
      {/* Header */}
      <div className={styles.detailHeader}>
        <div>
          <div className={styles.headerNav}>
            <Link href="/abandoned" className={styles.backButton}>
              <ArrowLeft size={18} />
            </Link>
            <h1 className={styles.title}>Abandoned Order #{order.orderNumber}</h1>
            <span 
              className={styles.badge}
              style={{ 
                backgroundColor: getStatusColor(order.orderCalled),
                color: 'white'
              }}
            >
              {getStatusText(order.orderCalled)}
            </span>
          </div>
          <p className={styles.subtitle}>
            Created on {new Date(order.createdAt).toLocaleDateString('en-IN', { 
              day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
            })}
          </p>
        </div>
        <div className={styles.headerActions}>
          <button onClick={createOrderFromAbandoned} className={styles.secondaryBtn}>
            <ShoppingCart size={16} />
            Create Order
          </button>
        </div>
      </div>

      {/* Status Bar with quick actions */}
      <div className={styles.statusBar}>
        <div className={styles.statusInfo}>
          <div className={styles.statusMeta}>
            <Calendar size={16} />
            <span>{new Date(order.createdAt).toLocaleDateString()}</span>
            <span className={styles.dot}>•</span>
            <ShoppingCart size={16} />
            <span>{order.orderItems?.length} items</span>
            <span className={styles.dot}>•</span>
            <span className={styles.totalAmount}>{formatCurrency(order.finalAmount)}</span>
          </div>
        </div>
        <div className={styles.statusActions}>
          <button
            onClick={() => markAsCalled('Called')}
            className={styles.secondaryBtn}
            disabled={order.orderCalled === 'Called'}
          >
            <PhoneCall size={16} />
            Mark Called
          </button>
          <button
            onClick={() => markAsCalled('notpicked')}
            className={styles.secondaryBtn}
            disabled={order.orderCalled === 'notpicked'}
          >
            <PhoneOff size={16} />
            Not Picked
          </button>
          <button
            onClick={() => setIsEditing(!isEditing)}
            className={isEditing ? styles.secondaryBtn : styles.secondaryBtn}
          >
            <Edit size={16} />
            {isEditing ? 'Cancel Edit' : 'Edit Details'}
          </button>
          <button
            onClick={deleteOrder}
            className={styles.dangerBtn}
          >
            <Trash2 size={16} />
            Delete
          </button>
        </div>
      </div>

      {/* Main content grid */}
      <div className={styles.detailGrid}>
        {/* Left column: Order Items & Payment Summary */}
        <div className={styles.detailMain}>
          {/* Order Items */}
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>
              <ShoppingCart size={20} />
              Order Items ({order.orderItems?.length || 0})
            </h2>
            <div className={styles.itemsList}>
              {order.orderItems?.map((item, index) => (
                <div key={index} className={styles.detailItem}>
                  <Image
                    src={modifyCloudinaryUrl(item?.product?.images?.[0]?.url)}
                    alt={item?.product?.title}
                    width={80}
                    height={80}
                    className={styles.detailItemImage}
                  />
                  <div className={styles.detailItemInfo}>
                    <h4>{item?.product?.title}</h4>
                    <p className={styles.itemSku}>SKU: {item.sku}</p>
                    <div className={styles.itemMeta}>
                      <span className={styles.itemPrice}>₹{item.price}</span>
                      <span className={styles.itemQty}>Qty: {item.quantity}</span>
                    </div>
                  </div>
                  <div className={styles.detailItemTotal}>
                    ₹{(item.price * item.quantity).toFixed(0)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Payment Summary */}
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Payment Summary</h2>
            <div className={styles.paymentSummary}>
              <div className={styles.summaryRow}>
                <span>Subtotal ({order.orderItems?.length} items):</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              <div className={styles.summaryRow}>
                <span>Shipping Cost:</span>
                <span>{formatCurrency(order.shippingCost || 0)}</span>
              </div>
              <div className={styles.summaryRow}>
                <span>Discount:</span>
                <span>-{formatCurrency(order.discount || 0)}</span>
              </div>
              <div className={styles.summaryTotal}>
                <span>Total Amount:</span>
                <span>{formatCurrency(order.finalAmount)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right column: Customer Info, Address, Metadata */}
        <div className={styles.detailSidebar}>
          {/* Customer Information */}
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>
              <User size={20} />
              Customer Information
            </h2>
            <div className={styles.customerInfo}>
              <div className={styles.contactRow}>
                <Mail size={16} />
                <span>{formData.email}</span>
              </div>
              <div className={styles.contactRow}>
                <Phone size={16} />
                <span>+91 {formData.phone}</span>
              </div>
              {formData.mobile && (
                <div className={styles.contactRow}>
                  <Phone size={16} />
                  <span>Alt: +91 {formData.mobile}</span>
                </div>
              )}
            </div>
          </div>

          {/* Shipping Address (with edit form) */}
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>
              <MapPin size={20} />
              Shipping Address
            </h2>
            {isEditing ? (
              <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <label>First Name</label>
                  <input
                    type="text"
                    value={formData.firstname}
                    onChange={(e) => handleInputChange('firstname', e.target.value)}
                    className={styles.input}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Last Name</label>
                  <input
                    type="text"
                    value={formData.lastname}
                    onChange={(e) => handleInputChange('lastname', e.target.value)}
                    className={styles.input}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    className={styles.input}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Phone</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    className={styles.input}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Alternate Phone</label>
                  <input
                    type="tel"
                    value={formData.mobile}
                    onChange={(e) => handleInputChange('mobile', e.target.value)}
                    className={styles.input}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Address</label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => handleInputChange('address', e.target.value)}
                    className={styles.input}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>City</label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => handleInputChange('city', e.target.value)}
                    className={styles.input}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>State</label>
                  <input
                    type="text"
                    value={formData.state}
                    onChange={(e) => handleInputChange('state', e.target.value)}
                    className={styles.input}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Pincode</label>
                  <input
                    type="text"
                    value={formData.pincode}
                    onChange={(e) => handleInputChange('pincode', e.target.value)}
                    className={styles.input}
                  />
                </div>
                <div className={styles.formActions}>
                  <button
                    onClick={updateOrder}
                    disabled={saving}
                    className={styles.saveButton}
                  >
                    {saving ? (
                      <>
                        <div className={styles.spinner}></div>
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save size={16} />
                        Save Changes
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className={styles.address}>
                <MapPin size={14} />
                <div>
                  <p><strong>{formData.firstname} {formData.lastname}</strong></p>
                  <p>{formData.address}</p>
                  <p>{formData.city}, {formData.state} - {formData.pincode}</p>
                </div>
              </div>
            )}
          </div>

          {/* Order Metadata */}
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>
              <Calendar size={20} />
              Order Information
            </h2>
            <div className={styles.orderMeta}>
              <div className={styles.metaItem}>
                <span>Order Number:</span>
                <strong>#{order.orderNumber}</strong>
              </div>
              <div className={styles.metaItem}>
                <span>Created:</span>
                <span>{new Date(order.createdAt).toLocaleString()}</span>
              </div>
              <div className={styles.metaItem}>
                <span>Order Type:</span>
                <span>{order.orderType || 'N/A'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SingleAbandonedPage;