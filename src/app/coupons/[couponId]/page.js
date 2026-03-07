'use client'
import React, { useEffect, useState } from 'react'
import styles from '../coupon.module.css'
import { Save, ArrowLeft, Calendar, Users, Tag, Package } from 'lucide-react'
import { useSelector } from 'react-redux'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'

const CouponForm = ({ params }) => {
  const {couponId} = useParams();
  const [formData, setFormData] = useState({
    name: '',
    discounttype: 'order',
    expiry: '',
    customertype: 'all',
    discount: '',
    status: 'draft',
    minItem: 0,
    cEmail: ''
  })
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const router = useRouter()
  const user = useSelector((state) => state.auth.user)

  useEffect(() => {
    if (couponId && couponId !== 'new') {
      fetchCoupon()
    }
  }, [couponId])

  const fetchCoupon = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/coupon/get-coupon?id=${couponId}`)
      if (!response.ok) throw new Error('Failed to fetch coupon')
      
      const data = await response.json()
      setFormData({
        name: data.name || '',
        discounttype: data.discounttype || 'order',
        expiry: data.expiry ? data.expiry.split('T')[0] : '',
        customertype: data.customertype || 'all',
        discount: data.discount || '',
        status: data.status || 'draft',
        minItem: data.minItem || 0,
        cEmail: data.cEmail || ''
      })
    } catch (err) {
      console.error("Error fetching coupon:", err)
      toast.error("Failed to load coupon")
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const validateForm = () => {
    if (!formData.name.trim()) {
      toast.error("Please enter coupon name")
      return false
    }
    if (!formData.expiry) {
      toast.error("Please select expiry date")
      return false
    }
    if (formData.discounttype !== 'freeShip' && !formData.discount) {
      toast.error("Please enter discount amount")
      return false
    }
    if (formData.customertype === 'specific' && !formData.cEmail) {
      toast.error("Please enter customer email")
      return false
    }
    if (formData.discounttype === 'buyX' && !formData.minItem) {
      toast.error("Please enter minimum items/amount")
      return false
    }
    return true
  }

  const saveCoupon = async () => {
    if (!validateForm()) return

    try {
      setSaving(true)
      const isEdit = couponId && couponId !== 'new'
      
      const response = await fetch(
        isEdit 
          ? `/api/coupon/update-coupon?id=${couponId}&token=${user?.token}`
          : `/api/coupon/create-coupon?token=${user?.token}`,
        {
          method: isEdit ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...formData,
            expiry: new Date(formData.expiry).toISOString()
          })
        }
      )

      if (!response.ok) throw new Error('Failed to save coupon')

      // Create history entry
      await fetch("/api/history/create-history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: user?.firstname,
          title: formData.name,
          sku: formData.discount,
          productchange: isEdit ? 'Discount Updated' : 'Discount Created',
          time: new Date().toISOString()
        }),
      })

      toast.success(`Coupon ${isEdit ? 'updated' : 'created'} successfully!`)
      router.push('/coupons')
      
    } catch (err) {
      console.error("Error saving coupon:", err)
      toast.error(`Failed to ${couponId ? 'update' : 'create'} coupon`)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner}></div>
        <p>Loading coupon...</p>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <Link href="/coupons" className={styles.backButton}>
            <ArrowLeft size={20} />
            Back to Coupons
          </Link>
          <h1 className={styles.title}>
            {couponId ? 'Edit Coupon' : 'Create New Coupon'}
          </h1>
          <p className={styles.subtitle}>
            {couponId ? 'Update your discount coupon' : 'Create a new discount coupon for your customers'}
          </p>
        </div>
        <button 
          onClick={saveCoupon} 
          className={styles.saveButton}
          disabled={saving}
        >
          {saving ? (
            <div className={styles.spinner}></div>
          ) : (
            <Save size={18} />
          )}
          {saving ? 'Saving...' : (couponId ? 'Update Coupon' : 'Create Coupon')}
        </button>
      </div>

      {/* Form */}
      <div className={styles.formContainer}>
        <div className={styles.formGrid}>
          {/* Left Column */}
          <div className={styles.formColumn}>
            <div className={styles.formSection}>
              <h3 className={styles.sectionTitle}>
                <Tag size={18} />
                Coupon Details
              </h3>
              
              <div className={styles.formGroup}>
                <label className={styles.label}>
                  Coupon Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g., SUMMER25, WELCOME10"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className={styles.input}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>
                  Discount Type *
                </label>
                <select
                  value={formData.discounttype}
                  onChange={(e) => handleInputChange('discounttype', e.target.value)}
                  className={styles.select}
                >
                  <option value="order">Order Discount</option>
                  <option value="buyX">Buy X Get Y</option>
                  <option value="freeShip">Free Shipping</option>
                </select>
              </div>

              {formData.discounttype === 'buyX' && (
                <div className={styles.formGroup}>
                  <label className={styles.label}>
                    Minimum Quantity/Amount *
                  </label>
                  <input
                    type="number"
                    placeholder="e.g., 2 for minimum 2 items, 1000 for minimum ₹1000"
                    value={formData.minItem}
                    onChange={(e) => handleInputChange('minItem', e.target.value)}
                    className={styles.input}
                  />
                </div>
              )}

              {formData.discounttype !== 'freeShip' && (
                <div className={styles.formGroup}>
                  <label className={styles.label}>
                    Discount Value *
                  </label>
                  <input
                    type="text"
                    placeholder={formData.discounttype === 'order' ? 'e.g., 25% or 499' : 'e.g., 1 (free item)'}
                    value={formData.discount}
                    onChange={(e) => handleInputChange('discount', e.target.value)}
                    className={styles.input}
                  />
                  <span className={styles.helperText}>
                    {formData.discounttype === 'order' 
                      ? 'Use percentage (25%) or fixed amount (499)' 
                      : 'Enter the number of free items'}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Right Column */}
          <div className={styles.formColumn}>
            <div className={styles.formSection}>
              <h3 className={styles.sectionTitle}>
                <Calendar size={18} />
                Validity & Audience
              </h3>

              <div className={styles.formGroup}>
                <label className={styles.label}>
                  Expiry Date *
                </label>
                <input
                  type="date"
                  value={formData.expiry}
                  onChange={(e) => handleInputChange('expiry', e.target.value)}
                  className={styles.input}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>
                  Status *
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => handleInputChange('status', e.target.value)}
                  className={styles.select}
                >
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                </select>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>
                  Customer Type *
                </label>
                <select
                  value={formData.customertype}
                  onChange={(e) => handleInputChange('customertype', e.target.value)}
                  className={styles.select}
                >
                  <option value="all">All Customers</option>
                  <option value="specific">Specific Customer</option>
                </select>
              </div>

              {formData.customertype === 'specific' && (
                <div className={styles.formGroup}>
                  <label className={styles.label}>
                    Customer Email *
                  </label>
                  <input
                    type="email"
                    placeholder="customer@example.com"
                    value={formData.cEmail}
                    onChange={(e) => handleInputChange('cEmail', e.target.value)}
                    className={styles.input}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Preview Section */}
        <div className={styles.previewSection}>
          <h3 className={styles.sectionTitle}>Preview</h3>
          <div className={styles.previewCard}>
            <div className={styles.previewHeader}>
              <h4>{formData.name || 'Coupon Name'}</h4>
              <span className={styles.previewDiscount}>
                {formData.discounttype === 'freeShip' ? 'Free Shipping' : 
                 formData.discounttype === 'order' ? (formData.discount || '0%') : 
                 `Buy ${formData.minItem || 'X'} Get ${formData.discount || 'Y'}`}
              </span>
            </div>
            <div className={styles.previewDetails}>
              <p>Status: <span>{formData.status}</span></p>
              <p>Expires: <span>{formData.expiry || 'Not set'}</span></p>
              <p>For: <span>{formData.customertype === 'all' ? 'All Customers' : formData.cEmail || 'Specific Customer'}</span></p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CouponForm