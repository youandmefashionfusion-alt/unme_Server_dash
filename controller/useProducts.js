import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';

const PRODUCTS_PER_PAGE = 60;

export const useProducts = () => {
  const [products, setProducts] = useState([]);
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, hasMore: false });
  
  const { user } = useSelector((state) => state.auth || {});
  const router = useRouter();
  const searchParams = useSearchParams();

  const page = parseInt(searchParams.get('page')) || 1;
  const stateFilter = searchParams.get('state') || 'all';
  const collectionFilter = searchParams.get('collection') || '';

  // Fetch collections
  const fetchCollections = useCallback(async () => {
    try {
      const res = await fetch('/api/collection/getallcollections');
      const data = await res.json();
      if (res.ok) setCollections(data || []);
    } catch (error) {
      console.error('Failed to fetch collections:', error);
    }
  }, []);

  // Fetch products
  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({
        page,
        limit: PRODUCTS_PER_PAGE,
        state: stateFilter,
        ...(collectionFilter && { collectionHandle: collectionFilter }),
      });

      const res = await fetch(`/api/products?${query.toString()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      });

      const data = await res.json();
      
      if (res.ok) {
        const currentPage = data?.pagination?.currentPage || page;
        const totalPages = data?.pagination?.totalPages || currentPage;
        setProducts(data.products || []);
        setPagination({ page: currentPage, hasMore: currentPage < totalPages });
      } else {
        toast.error('Failed to fetch products');
      }
    } catch (error) {
      console.error('Error fetching products:', error);
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  }, [page, stateFilter, collectionFilter]);

  // Update URL when filters change
  const updateFilters = useCallback((newFilters) => {
    const params = new URLSearchParams(searchParams);
    
    Object.entries(newFilters).forEach(([key, value]) => {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    });
    
    router.push(`/products?${params.toString()}`);
  }, [router, searchParams]);

  // Delete product
  const deleteProduct = useCallback(async (product) => {
    if (!confirm(`Delete "${product.title}"?`)) return false;
    
    try {
      const res = await fetch(`/api/products/delete-product?id=${product._id}&token=${user?.token}`, {
        method: 'DELETE',
      });
      
      const data = await res.json();
      
      if (data.status === 200) {
        toast.success('Product deleted');
        fetchProducts();
        return true;
      } else {
        toast.error('Delete failed');
        return false;
      }
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Failed to delete product');
      return false;
    }
  }, [user, fetchProducts]);

  // Duplicate product
  const duplicateProduct = useCallback(async (product) => {
    const count = parseInt(prompt('Enter number of duplicates:', '1'));
    if (!count || count <= 0) {
      toast.error('Invalid count');
      return false;
    }

    try {
      for (let i = 0; i < count; i++) {
        await fetch(`/api/products/create-product?token=${user?.token}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...product,
            _id: undefined,
            handle: `${product.handle}-copy-${i + 1}`,
            state: 'draft',
          }),
        });
      }
      
      toast.success(`${count} product(s) duplicated`);
      fetchProducts();
      return true;
    } catch (error) {
      console.error('Duplicate error:', error);
      toast.error('Duplication failed');
      return false;
    }
  }, [user, fetchProducts]);

  // Toggle sale status
  const toggleSale = useCallback(async (productId, saleName, currentValue) => {
    try {
      const res = await fetch(`/api/products/update-sale?token=${user?.token}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prodId: productId,
          saleName,
          saleValue: !currentValue,
        }),
      });

      const data = await res.json();

      if (data.status) {
        toast.success('Sale status updated');
        fetchProducts();
        return true;
      } else {
        toast.error(data.msg || 'Update failed');
        return false;
      }
    } catch (error) {
      console.error('Sale toggle error:', error);
      toast.error('Failed to update sale status');
      return false;
    }
  }, [user, fetchProducts]);

  useEffect(() => {
    fetchCollections();
  }, [fetchCollections]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  return {
    products,
    collections,
    loading,
    pagination,
    filters: { page, state: stateFilter, collection: collectionFilter },
    updateFilters,
    deleteProduct,
    duplicateProduct,
    toggleSale,
    fetchProducts,
  };
};
