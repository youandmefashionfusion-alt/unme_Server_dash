'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import * as XLSX from 'xlsx';
import { Upload, Download, CheckCircle, XCircle, Loader, AlertCircle } from 'lucide-react';
import styles from './bulkupload.module.css';
import toast from 'react-hot-toast';

const BulkUploadPage = () => {
  const { user } = useSelector((state) => state.auth);
  const [collections, setCollections] = useState([]);
  const [selectedCollection, setSelectedCollection] = useState('');
  const [selectedHandle, setSelectedHandle] = useState('');
  const [defaultProductState, setDefaultProductState] = useState('draft');
  const [file, setFile] = useState(null);
  const [products, setProducts] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState([]);
  const [step, setStep] = useState(1); // 1: select collection, 2: upload file, 3: review, 4: results

  // Fetch collections
  useEffect(() => {
    const fetchCollections = async () => {
      try {
        const res = await fetch('/api/collection/getallcollections');
        const data = await res.json();
        if (res.ok) setCollections(data || []);
      } catch (error) {
        console.error('Failed to fetch collections:', error);
        toast.error('Failed to load collections');
      }
    };
    fetchCollections();
  }, []);

  // Generate handle from title
  const generateHandle = useCallback((title) => {
    return title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }, []);

  const normalizeProductState = useCallback((value, fallback = 'draft') => {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'active' || normalized === 'draft') {
      return normalized;
    }
    return fallback;
  }, []);

  const normalizeHeader = useCallback((header) => {
    return String(header || '')
      .replace(/^\uFEFF/, '')
      .trim()
      .toLowerCase();
  }, []);

  const normalizeRow = useCallback((row) => {
    const normalized = {};
    Object.entries(row || {}).forEach(([key, value]) => {
      normalized[normalizeHeader(key)] = value;
    });
    return normalized;
  }, [normalizeHeader]);

  const getFirstValue = useCallback((row, keys = []) => {
    for (const key of keys) {
      const value = row?.[normalizeHeader(key)];
      if (value === 0 || value === '0') return value;
      if (value !== undefined && value !== null && String(value).trim() !== '') {
        return value;
      }
    }
    return '';
  }, [normalizeHeader]);

  const parseNumeric = useCallback((value) => {
    if (value === undefined || value === null) return 0;
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;

    const cleaned = String(value)
      .replace(/[^\d.-]/g, '')
      .trim();
    const parsed = parseFloat(cleaned);
    return Number.isFinite(parsed) ? parsed : 0;
  }, []);

  const splitList = useCallback((value) => {
    if (!value && value !== 0) return [];
    if (Array.isArray(value)) {
      return value.map((entry) => String(entry || '').trim()).filter(Boolean);
    }
    return String(value)
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);
  }, []);

  const toHtmlDescription = useCallback((value) => {
    const text = String(value || '').trim();
    if (!text) return '';
    if (/<[a-z][\s\S]*>/i.test(text)) return text;
    return `<p>${text}</p>`;
  }, []);

  const collectImageUrls = useCallback((row) => {
    const urls = [];

    for (let i = 1; i <= 10; i += 1) {
      const main = getFirstValue(row, [`image link ${i}`, `image_link_${i}`]);
      const creative = getFirstValue(row, [
        `image link ${i} (creative)`,
        `image_link_${i}_creative`,
      ]);
      if (main) urls.push(String(main).trim());
      if (creative) urls.push(String(creative).trim());
    }

    const primaryImage = getFirstValue(row, ['image link', 'image_link']);
    if (primaryImage) {
      urls.push(String(primaryImage).trim());
    }

    return [...new Set(urls.filter(Boolean))];
  }, [getFirstValue]);

  // Upload image URL to S3 via backend
  const uploadImageToS3 = useCallback(async (imageUrl) => {
    try {
      let directUrl = imageUrl;
      if (imageUrl.includes('drive.google.com')) {
        const fileId = imageUrl.match(/\/d\/([^/]+)/)?.[1] || 
                       imageUrl.match(/id=([^&]+)/)?.[1];
        if (fileId) {
          directUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
        }
      }

      const res = await fetch('/api/upload/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: directUrl }),
      });

      const data = await res.json();

      if (data.success && data.result) {
        return {
          url: data.result.secure_url,
          public_id: data.result.public_id,
          asset_id: data.result.asset_id,
        };
      }
      throw new Error(data.message || 'Upload failed');
    } catch (error) {
      console.error('S3 upload error:', error);
      throw error;
    }
  }, []);

  // Parse Excel file
  const parseFile = useCallback(async (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);

          const parsed = jsonData.map((rawRow, index) => {
            const row = normalizeRow(rawRow);
            const images = collectImageUrls(row);

            // Generate SKU if not provided
            let sku = getFirstValue(row, ['sku', 'id']);
            if (!sku) {
              sku = `PRD-${Date.now().toString().slice(-6)}-${index + 1}`;
            }

            const rawSizes = getFirstValue(row, ['sizes', 'ring size', 'size']);

            const parsedState = normalizeProductState(
              getFirstValue(row, ['state', 'status', 'product status']),
              defaultProductState
            );

            const regularPrice = parseNumeric(getFirstValue(row, ['price']));
            const explicitCrossPrice = parseNumeric(
              getFirstValue(row, ['cross price'])
            );
            const salePrice = parseNumeric(getFirstValue(row, ['sale_price', 'sale price']));

            const hasSalePrice = salePrice > 0;
            const finalPrice = hasSalePrice ? salePrice : regularPrice;
            const finalCrossPrice = hasSalePrice
              ? regularPrice
              : explicitCrossPrice > finalPrice
                ? explicitCrossPrice
                : 0;

            const quantity = Math.round(
              parseNumeric(getFirstValue(row, ['quantity', 'quantity_to_sell_on_facebook']))
            );
            const typeFromFeed = splitList(getFirstValue(row, ['product_tags[1]', 'style[0]', 'type']));
            const collectionHandleFromFeed = getFirstValue(row, ['product_tags[0]', 'collectionhandle', 'collection handle']);

            return {
              title: String(getFirstValue(row, ['product title', 'title', 'name']) || '').trim(),
              description: toHtmlDescription(
                getFirstValue(row, ['description', 'body_html', 'meta description'])
              ),
              price: finalPrice || 0,
              crossPrice: finalCrossPrice || 0,
              quantity: Number.isFinite(quantity) ? Math.max(quantity, 0) : 0,
              gender: String(getFirstValue(row, ['gender']) || 'unisex').toLowerCase(),
              color: splitList(getFirstValue(row, ['color'])),
              material: splitList(getFirstValue(row, ['material'])),
              type: splitList(getFirstValue(row, ['type'])).length
                ? splitList(getFirstValue(row, ['type']))
                : typeFromFeed,
              necklaceType: splitList(getFirstValue(row, ['necklace type'])),
              ringDesign: splitList(getFirstValue(row, ['ring design'])),
              sizes: rawSizes
                ? String(rawSizes).split(',').map(r => r.trim()).filter(Boolean)
                : [],
              imageUrls: images.filter(Boolean),
              sku,
              state: parsedState,
              collectionHandleFromFeed: String(collectionHandleFromFeed || '').trim(),
              bossPicks: false,
              gatawayJewels: false,
              isFeatured: false,
              is999Sale: false,
              is899Sale: false,
              is1499Sale: false,
              metaTitle: getFirstValue(row, ['meta title', 'title', 'product title']) || '',
              metaDesc: getFirstValue(row, ['meta description', 'description']) || '',
            };
          });

          resolve(parsed.filter(p => p.title)); // Only products with title
        } catch (error) {
          reject(error);
        }
      };

      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  }, [
    collectImageUrls,
    defaultProductState,
    getFirstValue,
    normalizeProductState,
    normalizeRow,
    parseNumeric,
    splitList,
    toHtmlDescription,
  ]);

  // Handle file selection
  const handleFileChange = async (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
    ];

    if (!validTypes.includes(selectedFile.type)) {
      toast.error('Please upload Excel or CSV file');
      return;
    }

    setFile(selectedFile);
    const toastId = toast.loading('Parsing file...');

    try {
      const parsedProducts = await parseFile(selectedFile);
      setProducts(parsedProducts);
      toast.dismiss(toastId);
      
      if (parsedProducts.length === 0) {
        toast.error('No valid products found in file');
      } else {
        toast.success(`Loaded ${parsedProducts.length} products`);
        setStep(3);
      }
    } catch (error) {
      console.error('Parse error:', error);
      toast.dismiss(toastId);
      toast.error('Failed to parse file');
    }
  };

  // Start upload
  const startUpload = async () => {
    if (!selectedCollection) {
      toast.error('Please select a collection');
      setStep(1);
      return;
    }

    if (products.length === 0) {
      toast.error('No products to upload');
      return;
    }

    if (!user?.token) {
      toast.error('Authentication required');
      return;
    }

    setUploading(true);
    setProgress(0);
    setResults([]);
    setStep(4);

    const results = [];
    let successCount = 0;

    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      
      try {
        setProgress(Math.round(((i + 1) / products.length) * 100));

        // Upload images
        const uploadedImages = [];
        for (const url of product.imageUrls.slice(0, 5)) { // Limit to 5 images
          try {
            const uploaded = await uploadImageToS3(url);
            uploadedImages.push(uploaded);
          } catch (err) {
            console.error(`Failed to upload image: ${url}`, err);
          }
        }

        // Prepare product data
        const productData = {
          ...product,
          state: normalizeProductState(product.state, defaultProductState),
          handle: generateHandle(product.title),
          collectionName: selectedCollection,
          collectionHandle: selectedHandle,
          images: uploadedImages,
        };
        delete productData.imageUrls;
        delete productData.collectionHandleFromFeed;

        // Create product
        const res = await fetch(`/api/products/create-product?token=${user.token}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(productData),
        });

        const data = await res.json();

        if (data.status === 200 || data.success) {
          successCount++;
          results.push({
            title: product.title,
            status: 'success',
            message: 'Created successfully',
          });
        } else {
          results.push({
            title: product.title,
            status: 'error',
            message: data.message || 'Creation failed',
          });
        }
      } catch (error) {
        console.error(`Error uploading ${product.title}:`, error);
        results.push({
          title: product.title,
          status: 'error',
          message: error.message || 'Upload failed',
        });
      }

      setResults([...results]);
    }

    setUploading(false);
    toast.success(`Upload complete: ${successCount} succeeded, ${products.length - successCount} failed`);
  };

  // Reset upload
  const resetUpload = () => {
    setFile(null);
    setProducts([]);
    setResults([]);
    setProgress(0);
    setStep(1);
  };

  // Download template
  const downloadTemplate = () => {
    const template = [
      {
        'Product Title': 'Gold Pendant Necklace',
        'Description': 'Elegant gold plated pendant necklace',
        'Status': 'draft',
        'Price': 899,
        'Cross Price': 1499,
        'Quantity': 15,
        'Gender': 'Female',
        'Color': 'Gold, Rose Gold',
        'Material': 'Stainless Steel',
        'Type': 'Necklace',
        'Necklace Type': 'Pendant',
        'Ring Design': '',
        'Sizes': '',
        'SKU': 'NP-GD-001',
        'Image Link 1': 'https://example.com/image1.jpg',
        'Image Link 2': 'https://example.com/image2.jpg',
        'Meta Title': 'Gold Pendant Necklace - UnMe Jewels',
        'Meta Description': 'Buy elegant gold pendant necklace online',
      },
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, 'product_upload_template.xlsx');
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Bulk Product Upload</h1>
          <p className={styles.subtitle}>Upload multiple products at once using Excel/CSV</p>
        </div>
        <button onClick={downloadTemplate} className={styles.secondaryBtn}>
          <Download size={16} />
          Download Template
        </button>
      </div>

      {/* Progress Steps */}
      <div className={styles.steps}>
        <div className={`${styles.step} ${step >= 1 ? styles.active : ''}`}>
          <div className={styles.stepNumber}>1</div>
          <span>Select Collection</span>
        </div>
        <div className={`${styles.step} ${step >= 2 ? styles.active : ''}`}>
          <div className={styles.stepNumber}>2</div>
          <span>Upload File</span>
        </div>
        <div className={`${styles.step} ${step >= 3 ? styles.active : ''}`}>
          <div className={styles.stepNumber}>3</div>
          <span>Review</span>
        </div>
        <div className={`${styles.step} ${step >= 4 ? styles.active : ''}`}>
          <div className={styles.stepNumber}>4</div>
          <span>Upload</span>
        </div>
      </div>

      <div className={styles.content}>
        {/* Step 1: Select Collection */}
        {step === 1 && (
          <div className={styles.card}>
            <div className={styles.cardIcon}>📁</div>
            <h3>Select Collection</h3>
            <p>Choose the collection where products will be added</p>
            
            <div className={styles.collectionSelect}>
              <select
                value={selectedCollection}
                onChange={(e) => {
                  const id = e.target.value;
                  const collection = collections.find(c => c._id === id);
                  setSelectedCollection(id);
                  setSelectedHandle(collection?.handle || '');
                }}
                className={styles.select}
              >
                <option value="">-- Select a collection --</option>
                {collections.map((col) => (
                  <option key={col._id} value={col._id}>
                    {col.title || col.name}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.collectionSelect}>
              <select
                value={defaultProductState}
                onChange={(e) => setDefaultProductState(normalizeProductState(e.target.value, 'draft'))}
                className={styles.select}
              >
                <option value="draft">Default Product Status: Draft</option>
                <option value="active">Default Product Status: Active</option>
              </select>
            </div>

            <div className={styles.buttonGroup}>
              <button
                onClick={() => setStep(2)}
                disabled={!selectedCollection}
                className={styles.primaryBtn}
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Upload File */}
        {step === 2 && (
          <div className={styles.card}>
            <div className={styles.cardIcon}>📤</div>
            <h3>Upload File</h3>
            <p>Upload Excel or CSV file with product data</p>

            <div className={styles.uploadArea}>
              <input
                type="file"
                id="file-upload"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileChange}
                className={styles.fileInput}
              />
              <label htmlFor="file-upload" className={styles.fileLabel}>
                <Upload size={32} />
                <span>{file ? file.name : 'Click to upload or drag & drop'}</span>
                <small>Excel or CSV (max 100 products)</small>
              </label>
            </div>

            <div className={styles.buttonGroup}>
              <button onClick={() => setStep(1)} className={styles.secondaryBtn}>
                Back
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Review */}
        {step === 3 && (
          <div className={styles.card}>
            <div className={styles.cardIcon}>📋</div>
            <h3>Review Products</h3>
            <p>{products.length} products ready to upload</p>

            <div className={styles.preview}>
              <div className={styles.previewHeader}>
                <span>Title</span>
                <span>SKU</span>
                <span>Status</span>
                <span>Price</span>
                <span>Images</span>
              </div>
              <div className={styles.previewList}>
                {products.slice(0, 5).map((product, i) => (
                  <div key={i} className={styles.previewItem}>
                    <span className={styles.previewTitle}>{product.title}</span>
                    <span className={styles.previewSku}>{product.sku}</span>
                    <span className={styles.previewSku}>{product.state}</span>
                    <span className={styles.previewPrice}>₹{product.price}</span>
                    <span className={styles.previewImages}>{product.imageUrls.length} images</span>
                  </div>
                ))}
                {products.length > 5 && (
                  <div className={styles.previewMore}>
                    +{products.length - 5} more products
                  </div>
                )}
              </div>
            </div>

            <div className={styles.buttonGroup}>
              <button onClick={() => setStep(2)} className={styles.secondaryBtn}>
                Back
              </button>
              <button onClick={startUpload} className={styles.primaryBtn}>
                <Upload size={16} />
                Start Upload
              </button>
              <button onClick={resetUpload} className={styles.textBtn}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Upload Progress & Results */}
        {step === 4 && (
          <div className={styles.card}>
            <div className={styles.cardIcon}>{uploading ? '⏳' : '✅'}</div>
            <h3>{uploading ? 'Uploading Products...' : 'Upload Complete'}</h3>

            {uploading && (
              <div className={styles.progress}>
                <div className={styles.progressBar}>
                  <div 
                    className={styles.progressFill} 
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
                <span className={styles.progressText}>{progress}%</span>
              </div>
            )}

            {results.length > 0 && (
              <div className={styles.results}>
                <div className={styles.resultsStats}>
                  <div className={styles.stat}>
                    <span className={styles.statValue}>
                      {results.filter(r => r.status === 'success').length}
                    </span>
                    <span className={styles.statLabel}>Success</span>
                  </div>
                  <div className={styles.stat}>
                    <span className={styles.statValue}>
                      {results.filter(r => r.status === 'error').length}
                    </span>
                    <span className={styles.statLabel}>Failed</span>
                  </div>
                  <div className={styles.stat}>
                    <span className={styles.statValue}>{results.length}</span>
                    <span className={styles.statLabel}>Total</span>
                  </div>
                </div>

                <div className={styles.resultsList}>
                  {results.map((result, i) => (
                    <div key={i} className={`${styles.resultItem} ${styles[result.status]}`}>
                      {result.status === 'success' ? (
                        <CheckCircle size={16} />
                      ) : (
                        <XCircle size={16} />
                      )}
                      <span className={styles.resultTitle}>{result.title}</span>
                      <span className={styles.resultMessage}>{result.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!uploading && (
              <div className={styles.buttonGroup}>
                <button onClick={resetUpload} className={styles.primaryBtn}>
                  Upload More Products
                </button>
                <button 
                  onClick={() => window.location.href = '/products'} 
                  className={styles.secondaryBtn}
                >
                  View All Products
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default BulkUploadPage;
