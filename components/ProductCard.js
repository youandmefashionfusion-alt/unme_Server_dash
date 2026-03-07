import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Trash2, Copy, Eye } from 'lucide-react';
import styles from '../src/app/products/Products.module.css';

const ProductCard = ({ 
  product, 
  onDelete, 
  onDuplicate, 
  onToggleSale,
  modifyImageUrl 
}) => {
  const getStockStatus = (quantity) => {
    if (quantity <= 0) return { label: 'Out of Stock', color: '#EF4444' };
    if (quantity <= 5) return { label: 'Low Stock', color: '#F59E0B' };
    return { label: 'In Stock', color: '#10B981' };
  };

  const getStatusClass = (state) => {
    switch (state) {
      case 'active': return styles.statusActive;
      case 'draft': return styles.statusDraft;
      default: return styles.statusInactive;
    }
  };

  const stockStatus = getStockStatus(product.quantity);
  const primaryImage = product.images?.[0]?.url || '/placeholder.jpg';

  return (
    <div className={styles.productCard}>
      {/* Image Section */}
      <div className={styles.productImageWrapper}>
        <Link href={`/products/${product._id}`} className={styles.productImageLink}>
          <div className={styles.productImageContainer}>
            <img
              src={modifyImageUrl(primaryImage)}
              alt={product.title}
              className={styles.productImage}
              loading="lazy"
            />
          </div>
        </Link>
        
        <div className={styles.productActions}>
          <button 
            onClick={() => onDelete(product)}
            className={styles.actionBtn}
            aria-label="Delete product"
          >
            <Trash2 size={16} />
          </button>
          <button 
            onClick={() => onDuplicate(product)}
            className={styles.actionBtn}
            aria-label="Duplicate product"
          >
            <Copy size={16} />
          </button>
        </div>

        <div className={`${styles.statusIndicator} ${getStatusClass(product.state)}`} />
      </div>

      {/* Content Section */}
      <div className={styles.productContent}>
        <Link href={`/products/${product._id}`} className={styles.productInfo}>
          <h3 className={styles.productTitle}>{product.title}</h3>
          <p className={styles.productSku}>SKU: {product.sku || '—'}</p>
          <div className={styles.productPrice}>
            <span className={styles.currentPrice}>₹{product.price}</span>
            {product.crossPrice > product.price && (
              <span className={styles.originalPrice}>₹{product.crossPrice}</span>
            )}
          </div>
          <div className={styles.productMeta}>
            <span 
              className={styles.stockBadge}
              style={{ 
                background: `${stockStatus.color}15`, 
                color: stockStatus.color 
              }}
            >
              {stockStatus.label} ({product.quantity})
            </span>
            {product.collectionName?.title && (
              <span className={styles.collectionBadge}>
                {product.collectionName.title}
              </span>
            )}
          </div>
        </Link>

        {/* Sale Buttons */}
        <div className={styles.saleButtons}>
          <button
            className={`${styles.saleBtn} ${product.is999Sale ? styles.saleActive : ''}`}
            onClick={() => onToggleSale(product._id, '999Sale', product.is999Sale)}
          >
            ₹999 Sale
          </button>
          <button
            className={`${styles.saleBtn} ${product.is1499Sale ? styles.saleActive : ''}`}
            onClick={() => onToggleSale(product._id, '1499Sale', product.is1499Sale)}
          >
            ₹1499 Sale
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductCard;