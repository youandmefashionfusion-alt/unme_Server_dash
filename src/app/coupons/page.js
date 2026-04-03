'use client'
import React, { useEffect, useState } from 'react'
import styles from './coupon.module.css'
import { Plus, Calendar, Users, Tag, Clock } from 'lucide-react'
import Link from 'next/link'

const CouponsList = () => {
  const [coupons, setCoupons] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchCoupons = async () => {
    try {
      setLoading(true)
      const response = await fetch("/api/coupon/get-coupons")
      if (!response.ok) throw new Error('Failed to fetch coupons')
      
      const data = await response.json()
      setCoupons(data || [])
    } catch (err) {
      console.error("Error fetching coupons:", err)
      toast.error("Failed to load coupons")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCoupons()
  }, [])

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'active': return '#10b981'
      case 'draft': return '#6b7280'
      case 'expired': return '#ef4444'
      default: return '#6b7280'
    }
  }

  const getDiscountDisplay = (discount, discountType) => {
    if (discount?.endsWith("%")) return discount
    if (discountType === 'freeShip') return 'Free Shipping'
    return `â‚¹${discount}`
  }

  const getCustomerTypeDisplay = (customerType, email) => {
    if (customerType === 'all') return 'All Customers'
    return email || 'Specific Customer'
  }

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <lottie-player src="/Loader-cat.json" background="transparent" speed="1" loop autoplay aria-label="Loading" style={{ width: 200, height: 200, display: "inline-block" }} />
        <p>Loading coupons...</p>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <h1 className={styles.title}>Coupons & Discounts</h1>
          <p className={styles.subtitle}>
            Manage discount codes and promotional offers for your store
          </p>
        </div>
        <Link href="/coupons/new" className={styles.primaryButton}>
          <Plus size={18} />
          Create Coupon
        </Link>
      </div>

      {/* Stats Overview */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statIcon}>
            <Tag size={24} />
          </div>
          <div className={styles.statContent}>
            <h3>{coupons.length}</h3>
            <p>Total Coupons</p>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: 'rgba(16, 185, 129, 0.1)' }}>
            <Calendar size={24} style={{ color: '#10b981' }} />
          </div>
          <div className={styles.statContent}>
            <h3>{coupons.filter(c => c.status === 'active').length}</h3>
            <p>Active</p>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: 'rgba(107, 114, 128, 0.1)' }}>
            <Clock size={24} style={{ color: '#6b7280' }} />
          </div>
          <div className={styles.statContent}>
            <h3>{coupons.filter(c => c.status === 'draft').length}</h3>
            <p>Draft</p>
          </div>
        </div>
      </div>

      {/* Coupons Grid */}
      {coupons.length > 0 ? (
        <div className={styles.couponsGrid}>
          {coupons.map((coupon) => (
            <Link 
              href={`/coupons/${coupon._id}`} 
              key={coupon._id}
              className={styles.couponCard}
            >
              <div className={styles.cardHeader}>
                <div className={styles.couponName}>
                  <h3>{coupon.name}</h3>
                  <span 
                    className={styles.statusBadge}
                    style={{ backgroundColor: getStatusColor(coupon.status) }}
                  >
                    {coupon.status}
                  </span>
                </div>
                <div className={styles.discountAmount}>
                  {getDiscountDisplay(coupon.discount, coupon.discounttype)}
                </div>
              </div>

              <div className={styles.cardContent}>
                <div className={styles.detailItem}>
                  <Tag size={16} />
                  <span className={styles.detailLabel}>Type:</span>
                  <span className={styles.detailValue}>
                    {coupon.discounttype === 'order' ? 'Order Discount' : 
                     coupon.discounttype === 'buyX' ? 'Buy X Get Y' : 'Free Shipping'}
                  </span>
                </div>
                
                <div className={styles.detailItem}>
                  <Users size={16} />
                  <span className={styles.detailLabel}>Customer:</span>
                  <span className={styles.detailValue}>
                    {getCustomerTypeDisplay(coupon.customertype, coupon.cEmail)}
                  </span>
                </div>

                <div className={styles.detailItem}>
                  <Calendar size={16} />
                  <span className={styles.detailLabel}>Expires:</span>
                  <span className={styles.detailValue}>
                    {new Date(coupon.expiry).toLocaleDateString('en-GB')}
                  </span>
                </div>

                {coupon.discounttype === 'buyX' && coupon.minItem && (
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Min Items:</span>
                    <span className={styles.detailValue}>{coupon.minItem}</span>
                  </div>
                )}
              </div>

              <div className={styles.cardFooter}>
                <span className={styles.createdDate}>
                  Created: {new Date(coupon.createdAt).toLocaleDateString()}
                </span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className={styles.emptyState}>
          <div className={styles.emptyIllustration}>
            <Tag size={48} />
          </div>
          <h3>No coupons yet</h3>
          <p>Create your first discount coupon to attract more customers</p>
          <Link href="/coupons/new" className={styles.primaryButton}>
            <Plus size={18} />
            Create First Coupon
          </Link>
        </div>
      )}
    </div>
  )
}

export default CouponsList



