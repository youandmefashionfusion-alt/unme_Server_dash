'use client';

import React, { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Save, Eye, Copy, Trash2, ArrowLeft } from 'lucide-react';
import { useProductForm } from '../../../../controller/useProductForm';
import ArrayInput from '../../../../components/ArrayInput';
import ImageUploader from '../../../../components/ImageUploader';
import styles from './product.module.css';
import toast from 'react-hot-toast';

const Editor = dynamic(
  () => import('react-draft-wysiwyg').then((mod) => mod.Editor),
  { ssr: false }
);

import 'react-draft-wysiwyg/dist/react-draft-wysiwyg.css';

const ProductDetailPage = () => {
  const params = useParams();
  const router = useRouter();
  const productId = params.id;
  const isNew = productId === 'addPrdt';

  const {
    mounted,
    loading,
    saving,
    formData,
    editorState,
    mainImage,
    collections,
    saleCollections,          // <-- added
    arrayInputs,
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
  } = useProductForm(productId, isNew);

  // Toggle sale collection selection
  const toggleSaleCollection = (collectionId) => {
    const current = formData.saleCollections || [];
    const newValue = current.includes(collectionId)
      ? current.filter(id => id !== collectionId)
      : [...current, collectionId];
    handleInputChange('saleCollections', newValue);
  };

  const handleDeleteProduct = async () => {
    const deleted = await deleteProduct();
    if (deleted) {
      router.replace('/products');
    }
  };

  if (!mounted) {
    return (
      <div className={styles.loading}>
        <lottie-player src="/Loader-cat.json" background="transparent" speed="1" loop autoplay aria-label="Loading" style={{ width: 200, height: 200, display: "inline-block" }} />
        <p>Loading...</p>
      </div>
    );
  }

  if (loading && !isNew) {
    return (
      <div className={styles.loading}>
        <lottie-player src="/Loader-cat.json" background="transparent" speed="1" loop autoplay aria-label="Loading" style={{ width: 200, height: 200, display: "inline-block" }} />
        <p>Loading product...</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Image Preview Modal */}
      {mainImage && (
        <div className={styles.modal} onClick={() => setMainImage('')}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            {mainImage.match(/\.(mp4|webm|ogg)$/i) ? (
              <video src={mainImage} controls autoPlay />
            ) : (
              <img src={mainImage} alt="Preview" />
            )}
            <button className={styles.modalClose} onClick={() => setMainImage('')}>
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className={styles.detailHeader}>
        <div className={styles.headerLeft}>
          <button onClick={() => router.back()} className={styles.backBtn}>
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className={styles.title}>
              {isNew ? 'Add New Product' : formData.title || 'Edit Product'}
            </h1>
            {!isNew && formData.sku && (
              <p className={styles.subtitle}>SKU: {formData.sku}</p>
            )}
          </div>
        </div>
        <div className={styles.headerRight}>
          {!isNew && (
            <>
              <button
                onClick={() => window.open(`https://unmejewels.com/products/${formData.handle}`, '_blank')}
                className={styles.secondaryBtn}
              >
                <Eye size={16} />
                View
              </button>
              <button
                onClick={duplicateProduct}
                className={styles.secondaryBtn}
                disabled={saving}
              >
                <Copy size={16} />
                Duplicate
              </button>
              <button
                onClick={handleDeleteProduct}
                className={styles.dangerBtn}
                disabled={saving}
              >
                <Trash2 size={16} />
                Delete
              </button>
            </>
          )}
          <button
            onClick={saveProduct}
            className={styles.primaryBtn}
            disabled={saving}
          >
            <Save size={16} />
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className={styles.detailGrid}>
        {/* Left Column - Main Content */}
        <div className={styles.detailMain}>
          {/* Basic Information */}
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Basic Information</h2>
            <div className={styles.formGrid2}>
              <div className={styles.field}>
                <label>Title *</label>
                <input
                  type="text"
                  placeholder="Product title"
                  value={formData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                />
              </div>
              <div className={styles.field}>
                <label>Handle *</label>
                <input
                  type="text"
                  placeholder="product-handle"
                  value={formData.handle}
                  onChange={(e) => handleInputChange('handle', e.target.value)}
                />
              </div>
              <div className={styles.field}>
                <label>Price (₹) *</label>
                <input
                  type="number"
                  placeholder="0"
                  value={formData.price}
                  onChange={(e) => handleInputChange('price', e.target.value)}
                  min="0"
                />
              </div>
              <div className={styles.field}>
                <label>Cross Price (₹)</label>
                <input
                  type="number"
                  placeholder="0"
                  value={formData.crossPrice}
                  onChange={(e) => handleInputChange('crossPrice', e.target.value)}
                  min="0"
                />
              </div>
            </div>

            <div className={styles.field}>
              <label>Description *</label>
              <Editor
                editorState={editorState}
                onEditorStateChange={handleEditorChange}
                toolbarClassName={styles.editorToolbar}
                wrapperClassName={styles.editorWrapper}
                editorClassName={styles.editor}
                toolbar={{
                  options: ['inline', 'blockType', 'list', 'textAlign', 'link', 'history'],
                  inline: { options: ['bold', 'italic', 'underline'] },
                  list: { options: ['unordered', 'ordered'] },
                  textAlign: { options: ['left', 'center', 'right'] },
                }}
              />
            </div>
          </div>

          {/* Media */}
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Media</h2>
            <ImageUploader
              images={formData.images}
              onUpload={handleUploadSuccess}
              onDelete={deleteImage}
              onMove={moveImage}
              onSetMain={setMainImage}
            />
          </div>
        </div>

        {/* Right Column - Sidebar */}
        <div className={styles.detailSidebar}>
          {/* Status & Settings */}
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Status & Settings</h2>
            <div className={styles.formGrid}>
              <div className={styles.field}>
                <label>Status</label>
                <select
                  value={formData.state}
                  onChange={(e) => handleInputChange('state', e.target.value)}
                >
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <div className={styles.field}>
                <label>Quantity</label>
                <input
                  type="number"
                  placeholder="0"
                  value={formData.quantity}
                  onChange={(e) => handleInputChange('quantity', parseInt(e.target.value) || 0)}
                  min="0"
                />
              </div>
              <div className={styles.field}>
                <label>Gender</label>
                <select
                  value={formData.gender}
                  onChange={(e) => handleInputChange('gender', e.target.value)}
                >
                  <option value="unisex">Unisex</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>
            </div>

            <div className={styles.toggles}>
              <div className={styles.toggleItem}>
                <span>999 Sale</span>
                <label className={styles.switch}>
                  <input
                    type="checkbox"
                    checked={formData.is999Sale}
                    onChange={(e) => handleInputChange('is999Sale', e.target.checked)}
                  />
                  <span className={styles.slider}></span>
                </label>
              </div>
              {/* <div className={styles.toggleItem}>
                <span>899 Sale</span>
                <label className={styles.switch}>
                  <input
                    type="checkbox"
                    checked={formData.is899Sale}
                    onChange={(e) => handleInputChange('is899Sale', e.target.checked)}
                  />
                  <span className={styles.slider}></span>
                </label>
              </div> */}
              <div className={styles.toggleItem}>
                <span>1499 Sale</span>
                <label className={styles.switch}>
                  <input
                    type="checkbox"
                    checked={formData.is1499Sale}
                    onChange={(e) => handleInputChange('is1499Sale', e.target.checked)}
                  />
                  <span className={styles.slider}></span>
                </label>
              </div>
              <div className={styles.toggleItem}>
                <span>Featured</span>
                <label className={styles.switch}>
                  <input
                    type="checkbox"
                    checked={formData.isFeatured}
                    onChange={(e) => handleInputChange('isFeatured', e.target.checked)}
                  />
                  <span className={styles.slider}></span>
                </label>
              </div>
              <div className={styles.toggleItem}>
                <span>Boss Picks</span>
                <label className={styles.switch}>
                  <input
                    type="checkbox"
                    checked={formData.bossPicks}
                    onChange={(e) => handleInputChange('bossPicks', e.target.checked)}
                  />
                  <span className={styles.slider}></span>
                </label>
              </div>
              <div className={styles.toggleItem}>
                <span>Gateway Jewels</span>
                <label className={styles.switch}>
                  <input
                    type="checkbox"
                    checked={formData.gatawayJewels}
                    onChange={(e) => handleInputChange('gatawayJewels', e.target.checked)}
                  />
                  <span className={styles.slider}></span>
                </label>
              </div>
            </div>
          </div>

          {/* Product Organization */}
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Organization</h2>
            <div className={styles.formGrid}>
              <div className={styles.field}>
                <label>SKU *</label>
                <input
                  type="text"
                  placeholder="SKU-001"
                  value={formData.sku}
                  onChange={(e) => handleInputChange('sku', e.target.value)}
                />
              </div>
              <div className={styles.field}>
                <label>Collection *</label>
                <select
                  value={formData.collectionName}
                  onChange={(e) => {
                    const selectedId = e.target.value;
                    const collection = collections.find(c => c._id === selectedId);
                    handleInputChange('collectionName', selectedId);
                    handleInputChange('collectionHandle', collection?.handle || '');
                  }}
                >
                  <option value="">Select Collection</option>
                  {collections.map((col) => (
                    <option key={col._id} value={col._id}>
                      {col.title || col.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* ========== NEW: Sale Collections ========== */}
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Sale Collections</h2>
            <div className={styles.saleCollectionsList}>
              {saleCollections.length === 0 ? (
                <p className={styles.emptyText}>No sale collections available</p>
              ) : (
                saleCollections.map((col) => (
                  <label key={col._id} className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={formData.saleCollections?.includes(col._id)}
                      onChange={() => toggleSaleCollection(col._id)}
                    />
                    <span>{col.title}</span>
                  </label>
                ))
              )}
            </div>
          </div>

          {/* Attributes */}
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Attributes</h2>
            
            <ArrayInput
              title="Colors"
              field="color"
              items={formData.color}
              inputValue={arrayInputs.color}
              onInputChange={handleArrayInputChange}
              onAdd={handleArrayAdd}
              onRemove={handleArrayRemove}
              placeholder="Add color"
            />

            <ArrayInput
              title="Materials"
              field="material"
              items={formData.material}
              inputValue={arrayInputs.material}
              onInputChange={handleArrayInputChange}
              onAdd={handleArrayAdd}
              onRemove={handleArrayRemove}
              placeholder="Add material"
            />

            <ArrayInput
              title="Types"
              field="type"
              items={formData.type}
              inputValue={arrayInputs.type}
              onInputChange={handleArrayInputChange}
              onAdd={handleArrayAdd}
              onRemove={handleArrayRemove}
              placeholder="Add type"
            />

            <ArrayInput
              title="Necklace Types"
              field="necklaceType"
              items={formData.necklaceType}
              inputValue={arrayInputs.necklaceType}
              onInputChange={handleArrayInputChange}
              onAdd={handleArrayAdd}
              onRemove={handleArrayRemove}
              placeholder="Add necklace type"
            />

            <ArrayInput
              title="Ring Designs"
              field="ringDesign"
              items={formData.ringDesign}
              inputValue={arrayInputs.ringDesign}
              onInputChange={handleArrayInputChange}
              onAdd={handleArrayAdd}
              onRemove={handleArrayRemove}
              placeholder="Add ring design"
            />

            <ArrayInput
              title="Sizes"
              field="sizes"
              items={formData.sizes}
              inputValue={arrayInputs.sizes}
              onInputChange={handleArrayInputChange}
              onAdd={handleArrayAdd}
              onRemove={handleArrayRemove}
              placeholder="Add size"
            />
          </div>

          {/* SEO */}
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>SEO</h2>
            <div className={styles.field}>
              <label>Meta Title</label>
              <input
                type="text"
                placeholder="SEO title"
                value={formData.metaTitle}
                onChange={(e) => handleInputChange('metaTitle', e.target.value)}
              />
            </div>
            <div className={styles.field}>
              <label>Meta Description</label>
              <textarea
                placeholder="SEO description"
                value={formData.metaDesc}
                onChange={(e) => handleInputChange('metaDesc', e.target.value)}
                rows={4}
              />
            </div>
          </div>

          {/* Insights (Edit only) */}
          {!isNew && (
            <div className={styles.card}>
              <h2 className={styles.cardTitle}>Insights</h2>
              <div className={styles.insights}>
                <div className={styles.insightItem}>
                  <span>Total Sold</span>
                  <strong>{formData.sold} units</strong>
                </div>
                <div className={styles.insightItem}>
                  <span>Order</span>
                  <strong>{formData.order}</strong>
                </div>
                <div className={styles.insightItem}>
                  <span>Rating</span>
                  <strong>{formData.totalRating} ⭐</strong>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductDetailPage;



