'use client';

import React, { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, Filter, X, Download } from 'lucide-react';
import { useProducts } from '../controller/useProducts';
import ProductCard from './ProductCard';
import styles from '../src/app/products/Products.module.css';
import toast from 'react-hot-toast';

const ProductsPage = () => {
  const router = useRouter();
  const {
    products,
    collections,
    loading,
    pagination,
    filters,
    updateFilters,
    deleteProduct,
    duplicateProduct,
    toggleSale,
  } = useProducts();

  const modifyImageUrl = useCallback((url) => {
    if (!url) return '/placeholder.jpg';
    const parts = url.split('/upload/');
    return `${parts[0]}/upload/c_limit,h_400,f_auto,q_70/${parts[1]}`;
  }, []);

  const clearFilters = useCallback(() => {
    updateFilters({ state: '', collection: '', page: 1 });
  }, [updateFilters]);

  const hasActiveFilters = filters.state || filters.collection;
  const handleExport = async () => {
    try {
      const response = await fetch(`/api/products/export`, {
        method: 'POST'
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Export failed');
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      // Get filename from Content-Disposition header
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = 'products.xlsx';
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^"]+)"?/);
        if (match) filename = match[1];
      }
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success('Export started');
    } catch (err) {
      toast.error(err.message || 'Failed to export orders');
    }
  };
  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Products</h1>
          <p className={styles.subtitle}>
            {products.length} {products.length === 1 ? 'product' : 'products'} in catalog
          </p>
        </div>
        <div className={styles.headerActions}>
          <Link href="/products/bulk-upload" className={styles.secondaryBtn}>
            <Plus size={16} />
            Bulk Upload
          </Link>
          <Link href="/products/addPrdt" className={styles.primaryBtn}>
            <Plus size={16} />
            Add Product
          </Link>
          <button className={styles.secondaryBtn} onClick={handleExport}>
            <Download size={18} />
            Export
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className={styles.filtersBar}>
        <div className={styles.filtersGroup}>
          <Filter size={16} className={styles.filterIcon} />

          <select
            value={filters.state}
            onChange={(e) => updateFilters({ state: e.target.value, page: 1 })}
            className={styles.filterSelect}
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="draft">Draft</option>
            <option value="inactive">Inactive</option>
          </select>

          <select
            value={filters.collection}
            onChange={(e) => updateFilters({ collection: e.target.value, page: 1 })}
            className={styles.filterSelect}
          >
            <option value="">All Collections</option>
            {collections.map((col) => (
              <option key={col._id} value={col.handle}>
                {col.title || col.name}
              </option>
            ))}
          </select>
        </div>

        {hasActiveFilters && (
          <button onClick={clearFilters} className={styles.clearFiltersBtn}>
            <X size={14} />
            Clear
          </button>
        )}
      </div>

      {/* Products Grid */}
      {loading && products.length === 0 ? (
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <p>Loading products...</p>
        </div>
      ) : products.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>🛍️</div>
          <h3>No products found</h3>
          <p>{hasActiveFilters ? 'Try adjusting your filters' : 'Add your first product to get started'}</p>
          {!hasActiveFilters && (
            <Link href="/products/addPrdt" className={styles.primaryBtn}>
              <Plus size={16} />
              Add Product
            </Link>
          )}
        </div>
      ) : (
        <>
          <div className={styles.grid}>
            {products.map((product) => (
              <ProductCard
                key={product._id}
                product={product}
                onDelete={deleteProduct}
                onDuplicate={duplicateProduct}
                onToggleSale={toggleSale}
                modifyImageUrl={modifyImageUrl}
              />
            ))}
          </div>

          {/* Pagination */}
          <div className={styles.pagination}>
            <button
              onClick={() => updateFilters({ page: filters.page - 1 })}
              disabled={filters.page <= 1}
              className={styles.pageBtn}
            >
              Previous
            </button>
            <span className={styles.pageInfo}>Page {filters.page}</span>
            <button
              onClick={() => updateFilters({ page: filters.page + 1 })}
              disabled={!pagination.hasMore}
              className={styles.pageBtn}
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default ProductsPage;