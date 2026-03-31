"use client"
import React, { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSelector } from 'react-redux'
import styles from './CollectionDetail.module.css'
import {
    ArrowLeft, Save, Trash2, Upload, X, Image, BarChart3, Settings,
    Download
} from 'lucide-react'
import toast from 'react-hot-toast'
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd'
import { uploadFileToS3 } from '@/lib/uploadToS3'

// ── Moved outside component — handles S3 → CloudFront + Cloudinary transforms ──
const getImageUrl = (url) => {
    if (!url) return '/placeholder.png'

    const cloudfront =
        process.env.NEXT_PUBLIC_CLOUDFRONT_URL || 'https://d2gtpgxs0y565n.cloudfront.net'

    // ✅ FIX: S3 URL → CloudFront
    if (url.includes('s3.') || url.includes('amazonaws.com')) {
        try {
            const urlObj = new URL(url)
            return `${cloudfront}${urlObj.pathname}`
        } catch {
            return url
        }
    }

    // Cloudinary → add transformations
    if (url.includes('res.cloudinary.com') && url.includes('/upload/')) {
        const parts = url.split('/upload/')
        return `${parts[0]}/upload/c_limit,h_100,f_auto,q_50/${parts[1]}`
    }

    return url
}

const CollectionDetail = () => {
    const params = useParams()
    const router = useRouter()
    const collectionId = params.id
    const isNewCollection = collectionId === 'new'

    const { user } = useSelector((state) => state.auth)
    const [uploadingImages, setUploadingImages] = useState({})

    const [formData, setFormData] = useState({
        title: '',
        handle: '',
        status: 'draft',
        isTrending: false,
        mostTrending: false,
        metaTitle: '',
        metaDesc: '',
        images: [],
        order: 0
    })

    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [products, setProducts] = useState([])
    const [productsLoading, setProductsLoading] = useState(false)

    useEffect(() => {
        if (!isNewCollection && collectionId) {
            fetchCollection()
        }
    }, [collectionId, isNewCollection])

    const fetchCollection = async () => {
        try {
            setLoading(true)
            const response = await fetch(`/api/collection/get-single-collection?id=${collectionId}`)
            const data = await response.json()

            if (response.ok && data) {
                setFormData({
                    title: data.title || '',
                    handle: data.handle || '',
                    status: data.status || 'draft',
                    isTrending: data.isTrending || false,
                    mostTrending: data.mostTrending || false,
                    metaTitle: data.metaTitle || '',
                    metaDesc: data.metaDesc || '',
                    images: data.images || [],
                    order: data.order || 0
                })
                if (data.handle) fetchProducts(data.handle)
            } else {
                toast.error('Collection not found')
                router.push('/collections')
            }
        } catch (error) {
            console.error('Error fetching collection:', error)
            toast.error('Failed to load collection')
        } finally {
            setLoading(false)
        }
    }

    const fetchProducts = async (handle) => {
        try {
            setProductsLoading(true)
            const response = await fetch(`/api/products?collectionHandle=${handle}&limit=10000`)
            const data = await response.json()
            if (response.ok) {
                setProducts(data.products || [])
            } else {
                toast.error('Failed to load products')
            }
        } catch (error) {
            console.error('Error fetching products:', error)
            toast.error('Error loading products')
        } finally {
            setProductsLoading(false)
        }
    }

    const handleInputChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }))
    }

    const handleImageUpload = async (file, imageIndex) => {
        if (!file) return
        try {
            setUploadingImages(prev => ({ ...prev, [imageIndex]: true }))
            const uploaded = await uploadFileToS3(file, { folder: 'collections' })
            const newImage = {
                public_id: uploaded.public_id,
                asset_id: uploaded.asset_id,
                url: uploaded.secure_url || uploaded.url
            }
            const updatedImages = [...formData.images]
            updatedImages[imageIndex] = newImage
            handleInputChange('images', updatedImages)
            toast.success(`Image ${imageIndex + 1} uploaded`)
        } catch (error) {
            console.error('Collection image upload error:', error)
            toast.error(error.message || 'Failed to upload image')
        } finally {
            setUploadingImages(prev => ({ ...prev, [imageIndex]: false }))
        }
    }

    const removeImage = (imageIndex) => {
        const updatedImages = formData.images.filter((_, index) => index !== imageIndex)
        handleInputChange('images', updatedImages)
    }

    const createHistory = async (action) => {
        try {
            await fetch('/api/history/create-history', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: user?.firstname,
                    title: formData.title,
                    productchange: action,
                    time: new Date()
                })
            })
        } catch (error) {
            console.error('Error creating history:', error)
        }
    }

    const saveCollection = async () => {
        if (!formData.title || !formData.handle) {
            toast.error('Please fill in all required fields')
            return
        }
        try {
            setSaving(true)
            const url = isNewCollection
                ? `/api/collection/create-collection?token=${user?.token}`
                : `/api/collection/update-collection?id=${collectionId}&token=${user?.token}`

            const response = await fetch(url, {
                method: isNewCollection ? 'POST' : 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            })
            const data = await response.json().catch(() => null)

            if (response.ok) {
                if (data && typeof data === 'object') {
                    setFormData(prev => ({
                        ...prev,
                        status: data.status || prev.status,
                        title: data.title || prev.title,
                        handle: data.handle || prev.handle,
                    }))
                }
                await createHistory(isNewCollection ? 'Created a Collection' : 'Updated a Collection')
                toast.success(`Collection ${isNewCollection ? 'created' : 'updated'} successfully!`)
                if (isNewCollection) router.push('/collections')
                if (!isNewCollection) fetchCollection()
            } else {
                toast.error(data?.message || `Unable to ${isNewCollection ? 'create' : 'update'} collection`)
            }
        } catch (error) {
            console.error('Error saving collection:', error)
            toast.error(`Unable to ${isNewCollection ? 'create' : 'update'} collection`)
        } finally {
            setSaving(false)
        }
    }

    const deleteCollection = async () => {
        if (!window.confirm(`Are you sure you want to delete "${formData.title}"?`)) return
        try {
            const response = await fetch(
                `/api/collection/delete-collection?id=${collectionId}&token=${user?.token}`,
                { method: 'DELETE' }
            )
            if (response.ok) {
                await createHistory('Deleted a Collection')
                toast.success('Collection deleted successfully')
                router.push('/collections')
            } else {
                toast.error('Unable to delete collection')
            }
        } catch (error) {
            console.error('Error deleting collection:', error)
            toast.error('Unable to delete collection')
        }
    }

    const exportData = async () => {
        try {
            const res = await fetch(`/api/products/export?collection=${formData.handle}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            })
            if (!res.ok) {
                const errorData = await res.json()
                throw new Error(errorData.error || 'Export failed')
            }
            const blob = await res.blob()
            const downloadUrl = URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.href = downloadUrl
            link.download = `products-${formData.handle}.xlsx`
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            URL.revokeObjectURL(downloadUrl)
            toast.success('Excel file downloaded successfully!')
        } catch (error) {
            console.error('Export error:', error)
            toast.error(error.message || 'Failed to export data')
        }
    }

    const handleOnDragEnd = (result) => {
        if (!result.destination) return
        const newItems = Array.from(products)
        const [reorderedItem] = newItems.splice(result.source.index, 1)
        newItems.splice(result.destination.index, 0, reorderedItem)
        setProducts(newItems)
    }

    const handleSaveOrder = async () => {
        try {
            const productIds = products.map(item => item._id)
            const response = await fetch('/api/products/reorder', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ productIds })
            })
            if (response.ok) {
                toast.success('Product order saved successfully!')
            } else {
                throw new Error('Failed to save order')
            }
        } catch (error) {
            console.error('Failed to save order:', error)
            toast.error('Failed to save product order.')
        }
    }

    if (loading) {
        return (
            <div className={styles.loading}>
                <div className={styles.spinner}></div>
                <p>Loading collection...</p>
            </div>
        )
    }

    return (
        <div className={styles.container}>
            {/* Header */}
            <div className={styles.header}>
                <div className={styles.headerContent}>
                    <div className={styles.headerTop}>
                        <button
                            type="button"
                            className={styles.backButton}
                            onClick={() => router.push('/collections')}
                            aria-label="Back to collections"
                        >
                            <ArrowLeft size={18} />
                        </button>
                        <h1>{isNewCollection ? 'Create Collection' : formData.title}</h1>
                    </div>
                    <p>{isNewCollection ? 'Add a new product collection' : 'Manage collection details and products'}</p>
                </div>

                <div className={styles.actionButtons}>
                    {!isNewCollection && (
                        <button onClick={deleteCollection} className={styles.deleteButton}>
                            <Trash2 size={16} />
                            Delete
                        </button>
                    )}
                    {!isNewCollection && (
                        <button className={styles.saveButton} onClick={exportData}>
                            <Download size={16} />
                            Export Data
                        </button>
                    )}
                    <button onClick={saveCollection} className={styles.saveButton} disabled={saving}>
                        <Save size={16} />
                        {saving ? 'Saving...' : 'Save'}
                    </button>
                </div>
            </div>

            <div className={styles.content}>
                {/* Left Column */}
                <div className={styles.leftColumn}>
                    <section className={styles.section}>
                        <h2><Settings size={20} />Basic Information</h2>
                        <div className={styles.formGrid}>
                            <div className={styles.field}>
                                <label>Title *</label>
                                <input
                                    type="text"
                                    placeholder="Collection title"
                                    value={formData.title}
                                    onChange={(e) => handleInputChange('title', e.target.value)}
                                />
                            </div>
                            <div className={styles.field}>
                                <label>Handle *</label>
                                <input
                                    type="text"
                                    placeholder="collection-handle"
                                    value={formData.handle}
                                    onChange={(e) => handleInputChange('handle', e.target.value)}
                                />
                            </div>
                            <div className={styles.field}>
                                <label>Order</label>
                                <input
                                    type="number"
                                    placeholder="Collection Order"
                                    value={formData.order}
                                    onChange={(e) => handleInputChange('order', Number(e.target.value))}
                                />
                            </div>
                        </div>
                    </section>

                    <section className={styles.section}>
                        <h2><Image size={20} />Collection Images</h2>
                        <div className={styles.imagesGrid}>
                            {[0, 1].map((index) => (
                                <div key={index} className={styles.imageUpload}>
                                    {formData.images[index] ? (
                                        <div className={styles.imagePreview}>
                                            {/* ✅ FIX: getImageUrl applied to collection preview images */}
                                            <img
                                                src={getImageUrl(formData.images[index].url)}
                                                alt={`Collection ${index + 1}`}
                                            />
                                            <button
                                                onClick={() => removeImage(index)}
                                                className={styles.removeImage}
                                            >
                                                <X size={16} />
                                            </button>
                                        </div>
                                    ) : (
                                        <label className={styles.uploadButton}>
                                            <Upload size={24} />
                                            {uploadingImages[index] ? 'Uploading...' : `Upload Image ${index + 1}`}
                                            <input
                                                type="file"
                                                accept="image/*"
                                                hidden
                                                disabled={Boolean(uploadingImages[index])}
                                                onChange={(e) => handleImageUpload(e.target.files?.[0], index)}
                                            />
                                        </label>
                                    )}
                                </div>
                            ))}
                        </div>
                    </section>

                    <section className={styles.section}>
                        <h2><BarChart3 size={20} />SEO Information</h2>
                        <div className={`${styles.formGrid} ${styles.seo}`}>
                            <div className={styles.field}>
                                <label>Meta Title</label>
                                <input
                                    type="text"
                                    placeholder="Meta title for SEO"
                                    value={formData.metaTitle}
                                    onChange={(e) => handleInputChange('metaTitle', e.target.value)}
                                />
                            </div>
                            <div className={styles.field}>
                                <label>Meta Description</label>
                                <textarea
                                    placeholder="Meta description for SEO"
                                    value={formData.metaDesc}
                                    onChange={(e) => handleInputChange('metaDesc', e.target.value)}
                                    rows={3}
                                />
                            </div>
                        </div>
                    </section>
                </div>

                {/* Right Column */}
                <div className={styles.rightColumn}>
                    <section className={styles.section}>
                        <h2><Settings size={20} />Collection Settings</h2>
                        <div className={styles.settingsGrid}>
                            <div className={styles.field}>
                                <label>Status</label>
                                <select
                                    value={formData.status}
                                    onChange={(e) => handleInputChange('status', e.target.value)}
                                >
                                    <option value="active">Active</option>
                                    <option value="draft">Draft</option>
                                </select>
                            </div>
                            <div className={styles.field}>
                                <label>Is Trending</label>
                                <select
                                    value={formData.isTrending.toString()}
                                    onChange={(e) => handleInputChange('isTrending', e.target.value === 'true')}
                                >
                                    <option value="true">Yes</option>
                                    <option value="false">No</option>
                                </select>
                            </div>
                            <div className={styles.field}>
                                <label>Most Trending</label>
                                <select
                                    value={formData.mostTrending.toString()}
                                    onChange={(e) => handleInputChange('mostTrending', e.target.value === 'true')}
                                >
                                    <option value="true">Yes</option>
                                    <option value="false">No</option>
                                </select>
                            </div>
                        </div>
                    </section>
                </div>
            </div>

            {/* Products Section with Drag & Drop */}
            {!isNewCollection && (
                <div className={styles.productsSection}>
                    <div className={styles.productsHeader}>
                        <h2>Products in Collection</h2>
                        {products.length > 0 && (
                            <button onClick={handleSaveOrder} className={styles.saveOrderButton}>
                                Save Order
                            </button>
                        )}
                    </div>

                    {productsLoading ? (
                        <div className={styles.loading}>Loading products...</div>
                    ) : products.length === 0 ? (
                        <div className={styles.noProducts}>
                            <p>No products in this collection yet.</p>
                        </div>
                    ) : (
                        <>
                            <div className={styles.productsListHeader}>
                                <span>Image</span>
                                <span>Title</span>
                                <span>SKU</span>
                                <span>Inventory</span>
                                <span>Status</span>
                            </div>
                            <DragDropContext onDragEnd={handleOnDragEnd}>
                                <Droppable
                                    droppableId="products"
                                    isDropDisabled={false}
                                    isCombineEnabled={false}
                                    ignoreContainerClipping={false}
                                >
                                    {(provided) => (
                                        <div
                                            {...provided.droppableProps}
                                            ref={provided.innerRef}
                                            className={styles.productsList}
                                        >
                                            {products.map((product, index) => (
                                                <Draggable
                                                    key={product._id}
                                                    draggableId={product._id}
                                                    index={index}
                                                >
                                                    {(provided, snapshot) => (
                                                        <div
                                                            ref={provided.innerRef}
                                                            {...provided.draggableProps}
                                                            {...provided.dragHandleProps}
                                                            className={`${styles.productItem} ${snapshot.isDragging ? styles.dragging : ''}`}
                                                        >
                                                            {/* ✅ FIX: getImageUrl applied to product list images */}
                                                            <img
                                                                src={getImageUrl(product.images?.[0]?.url)}
                                                                alt={product.title}
                                                                className={styles.productImage}
                                                            />
                                                            <span className={styles.productTitle}>{product.title}</span>
                                                            <span className={styles.productSku}>{product.sku}</span>
                                                            <span className={styles.productInventory}>
                                                                {product.variants?.reduce((total, v) => total + (v.quantity || 0), 0)}
                                                            </span>
                                                            <span className={styles.productStatus} data-state={product.state}>
                                                                {product.state}
                                                            </span>
                                                        </div>
                                                    )}
                                                </Draggable>
                                            ))}
                                            {provided.placeholder}
                                        </div>
                                    )}
                                </Droppable>
                            </DragDropContext>
                        </>
                    )}
                </div>
            )}
        </div>
    )
}

export default CollectionDetail
