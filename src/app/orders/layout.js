"use client"
import { useSelector } from 'react-redux'
import styles from './orders.module.css'
import Link from 'next/link'
import { ArrowLeft, Package } from 'lucide-react'

export default function OrdersLayout({ children }) {
  const user = useSelector((state) => state.auth.user)

  return (
    <div className={styles.ordersLayout}>
      <div className={styles.content}>
        {children}
      </div>
    </div>
  )
}