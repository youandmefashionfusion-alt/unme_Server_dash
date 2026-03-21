import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { EditorState, ContentState, convertToRaw } from 'draft-js';
import draftToHtml from 'draftjs-to-html';
import toast from 'react-hot-toast';

let htmlToDraft = null;
if (typeof window === 'object') {
  htmlToDraft = require('html-to-draftjs').default;
}

export const useProductForm = (productId, isNew = false) => {
  const { user } = useSelector((state) => state.auth);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dbProductId, setDbProductId] = useState('');
  const [collections, setCollections] = useState([]);
  const [saleCollections, setSaleCollections] = useState([]);
  const [mounted, setMounted] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    state: 'draft',
    handle: '',
    order: 0,
    sold: 0,
    ratings: [],
    totalRating: 0,
    description: '',
    price: '',
    crossPrice: '',
    isFeatured: false,
    sku: '',
    images: [],
    collectionName: '',
    collectionHandle: '',
    quantity: 0,
    color: [],
    material: [],
    type: [],
    necklaceType: [],
    ringDesign: [],
    sizes: [],
    gender: 'unisex',
    bossPicks: true,
    gatawayJewels: true,
    metaDesc: '',
    metaTitle: '',
    is999Sale: false,
    is899Sale: false,
    is1499Sale: false,
    saleCollections: [], // will always store IDs
  });

  const [editorState, setEditorState] = useState(() => EditorState.createEmpty());
  const [mainImage, setMainImage] = useState('');

  // Array input states
  const [arrayInputs, setArrayInputs] = useState({
    color: '',
    material: '',
    type: '',
    necklaceType: '',
    ringDesign: '',
    sizes: '',
  });

  // Fetch collections
  const fetchCollections = useCallback(async () => {
    try {
      const res = await fetch('/api/collection/getallcollections');
      const data = await res.json();
      if (res.ok) setCollections(data || []);
    } catch (error) {
      console.error('Error fetching collections:', error);
    }
  }, []);

  const fetchSaleCollections = useCallback(async () => {
    try {
      const res = await fetch('/api/sale-collection/getallcollections');
      const data = await res.json();
      if (res.ok) setSaleCollections(data || []);
    } catch (error) {
      console.error('Error fetching sale collections:', error);
    }
  }, []);

  // Fetch single product
  const fetchProduct = useCallback(async () => {
    if (isNew) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/products/single-product-dash?productHandle=${productId}`);
      const data = await res.json();

      if (data.success && data.product) {
        const product = data.product;
        setDbProductId(product._id || '');

        // ✅ Normalize saleCollections to array of IDs
        const saleCollectionIds = product.saleCollections?.map(sc => sc._id || sc) || [];
        const normalizedSizes = Array.isArray(product.sizes)
          ? product.sizes
          : Array.isArray(product.ringSize)
            ? product.ringSize
            : [];

        setFormData({
          title: product.title || '',
          state: product.state || 'draft',
          handle: product.handle || '',
          order: product.order || 0,
          sold: product.sold || 0,
          ratings: product.ratings || [],
          totalRating: product.totalRating || 0,
          description: product.description || '',
          price: product.price || '',
          crossPrice: product.crossPrice || '',
          isFeatured: product.isFeatured || false,
          sku: product.sku || '',
          images: product.images || [],
          collectionName: product.collectionName?._id || '',
          collectionHandle: product.collectionHandle || '',
          quantity: product.quantity || 0,
          color: product.color || [],
          material: product.material || [],
          type: product.type || [],
          necklaceType: product.necklaceType || [],
          ringDesign: product.ringDesign || [],
          sizes: normalizedSizes,
          gender: product.gender || 'unisex',
          bossPicks: product.bossPicks ?? true,
          gatawayJewels: product.gatawayJewels ?? true,
          metaDesc: product.metaDesc || '',
          metaTitle: product.metaTitle || '',
          is999Sale: product.is999Sale || false,
          is899Sale: product.is899Sale || false,
          is1499Sale: product.is1499Sale || false,
          saleCollections: saleCollectionIds,
        });

        // Update editor with description
        if (htmlToDraft && product.description) {
          try {
            const contentBlock = htmlToDraft(product.description);
            const contentState = ContentState.createFromBlockArray(contentBlock.contentBlocks);
            setEditorState(EditorState.createWithContent(contentState));
          } catch (error) {
            console.error('Error setting editor content:', error);
          }
        }
      } else {
        toast.error('Product not found');
      }
    } catch (error) {
      console.error('Error fetching product:', error);
      toast.error('Failed to load product');
    } finally {
      setLoading(false);
    }
  }, [productId, isNew]);

  // Handle input change
  const handleInputChange = useCallback((field, value) => {
    if (!mounted) return;
    setFormData(prev => ({ ...prev, [field]: value }));
  }, [mounted]);

  // Handle array input add
  const handleArrayAdd = useCallback((field, value) => {
    if (!value?.trim()) return;

    setFormData(prev => ({
      ...prev,
      [field]: [...(prev[field] || []), value],
    }));

    setArrayInputs(prev => ({ ...prev, [field]: '' }));
  }, []);

  // Handle array input remove
  const handleArrayRemove = useCallback((field, index) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].filter((_, i) => i !== index),
    }));
  }, []);

  // Handle array input change
  const handleArrayInputChange = useCallback((field, value) => {
    setArrayInputs(prev => ({ ...prev, [field]: value }));
  }, []);

  // Handle editor change
  const handleEditorChange = useCallback((newState) => {
    if (!mounted) return;
    setEditorState(newState);
    const rawContent = convertToRaw(newState.getCurrentContent());
    const htmlContent = draftToHtml(rawContent);
    setFormData(prev => ({ ...prev, description: htmlContent }));
  }, [mounted]);

  // Handle image upload success
  const handleUploadSuccess = useCallback((result) => {
    if (!mounted) return;

    let newImages = [];
    if (Array.isArray(result.info)) {
      newImages = result.info.map(img => ({
        public_id: img.public_id,
        url: img.secure_url,
        asset_id: img.asset_id,
      }));
    } else {
      newImages = [{
        public_id: result.info.public_id,
        url: result.info.secure_url,
        asset_id: result.info.asset_id,
      }];
    }

    setFormData(prev => ({
      ...prev,
      images: [...prev.images, ...newImages],
    }));

    toast.success(`Uploaded ${newImages.length} image(s)`);
  }, [mounted]);

  // Handle image delete
  const deleteImage = useCallback((publicId) => {
    if (!mounted || !publicId) return;

    setFormData(prev => ({
      ...prev,
      images: prev.images.filter(img =>
        img.public_id !== publicId &&
        img._id !== publicId &&
        img.id !== publicId &&
        !img.url?.includes(publicId)
      ),
    }));

    toast.success('Image deleted');
  }, [mounted]);

  // Handle image reorder
  const moveImage = useCallback((dragIndex, hoverIndex) => {
    if (!mounted) return;

    setFormData(prev => {
      const newImages = [...prev.images];
      const draggedImage = newImages[dragIndex];
      newImages.splice(dragIndex, 1);
      newImages.splice(hoverIndex, 0, draggedImage);
      return { ...prev, images: newImages };
    });
  }, [mounted]);

  // Validate form
  const validateForm = useCallback(() => {
    const required = ['title', 'handle', 'description', 'price', 'sku', 'collectionName'];
    const missing = required.filter(field => !formData[field]);

    if (missing.length > 0) {
      toast.error(`Missing: ${missing.join(', ')}`);
      return false;
    }
    return true;
  }, [formData]);

  // Save product
  const saveProduct = useCallback(async () => {
    if (!validateForm()) return false;
    if (!user?.token) {
      toast.error('Authentication required');
      return false;
    }

    setSaving(true);
    try {
      const url = isNew
        ? `/api/products/create-product?token=${user.token}`
        : `/api/products/update-product?id=${dbProductId || productId}&token=${user.token}`;

      const method = isNew ? 'POST' : 'PUT';

      // ✅ Ensure saleCollections is an array of IDs before sending
      const saleCollectionIds = Array.isArray(formData.saleCollections)
        ? formData.saleCollections.map(sc => sc._id || sc)
        : [];

      const formattedData = {
        ...formData,
        saleCollections: saleCollectionIds, // override with clean IDs
        images: formData.images.map(img => ({
          public_id: img.public_id || img.url,
          url: img.url,
          asset_id: img.asset_id || img.public_id,
        })),
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formattedData),
      });

      const data = await res.json();

      if (data.status === 200 || data.success) {
        // Create history
        await fetch('/api/history/create-history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: user?.firstname,
            title: formData.title,
            sku: formData.sku,
            productchange: isNew ? 'Created the Product' : 'Updated the Product',
            time: new Date(),
          }),
        });

        toast.success(`Product ${isNew ? 'created' : 'updated'} successfully`);
        return true;
      } else {
        toast.error(data.message || `Failed to ${isNew ? 'create' : 'update'} product`);
        return false;
      }
    } catch (error) {
      console.error('Save error:', error);
      toast.error(`Failed to ${isNew ? 'create' : 'update'} product`);
      return false;
    } finally {
      setSaving(false);
    }
  }, [formData, user, productId, dbProductId, isNew, validateForm]);

  // Delete product
  const deleteProduct = useCallback(async () => {
    if (!user?.token) {
      toast.error('Authentication required');
      return false;
    }

    if (!window.confirm('Delete this product?')) return false;

    setSaving(true);
    try {
      const res = await fetch(`/api/products/delete-product?id=${dbProductId || productId}&token=${user.token}`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (data.status === 200) {
        await fetch('/api/history/create-history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: user?.firstname,
            title: formData.title,
            sku: formData.sku,
            productchange: 'Deleted the Product',
            time: new Date(),
          }),
        });

        toast.success('Product deleted successfully');
        return true;
      } else {
        toast.error(data.message || 'Failed to delete product');
        return false;
      }
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Failed to delete product');
      return false;
    } finally {
      setSaving(false);
    }
  }, [user, productId, dbProductId, formData.title, formData.sku]);

  // Duplicate product
  const duplicateProduct = useCallback(async () => {
    if (!user?.token) {
      toast.error('Authentication required');
      return false;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/products/create-product?token=${user.token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          title: `${formData.title} - Copy`,
          handle: `${formData.handle}-copy-${Date.now()}`,
          state: 'draft',
          images: formData.images.map(img => ({ ...img })),
        }),
      });

      const data = await res.json();

      if (data.status === 200 || data.success) {
        await fetch('/api/history/create-history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: user?.firstname,
            title: formData.title,
            sku: formData.sku,
            productchange: 'Duplicated the Product',
            time: new Date(),
          }),
        });

        toast.success('Product duplicated successfully');
        return true;
      } else {
        toast.error(data.message || 'Failed to duplicate product');
        return false;
      }
    } catch (error) {
      console.error('Duplicate error:', error);
      toast.error('Failed to duplicate product');
      return false;
    } finally {
      setSaving(false);
    }
  }, [user, formData]);

  // Initialize
  useEffect(() => {
    setMounted(true);
    if (isNew) {
      setDbProductId('');
    }
    fetchCollections();
    fetchSaleCollections();
    if (!isNew && productId) {
      fetchProduct();
    }
  }, [fetchCollections, fetchSaleCollections, fetchProduct, productId, isNew]);

  const totals = useMemo(() => ({
    images: formData.images.length,
  }), [formData.images.length]);

  return {
    mounted,
    loading,
    saving,
    formData,
    editorState,
    mainImage,
    collections,
    saleCollections,
    arrayInputs,
    totals,
    setMainImage,
    handleInputChange,
    handleArrayAdd,
    handleArrayRemove,
    handleArrayInputChange,
    handleEditorChange,
    handleUploadSuccess,
    deleteImage,
    moveImage,
    saveProduct,
    deleteProduct,
    duplicateProduct,
  };
};

