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
import { uploadFileToS3 } from '@/lib/uploadToS3'

const CollectionDetail = () => {
    const params = useParams()
    const router = useRouter()
    const collectionId = params.id
    const isNewCollection = collectionId === 'new'

    const { user } = useSelector((state) => state.auth)

    const [formData, setFormData] = useState({
        title: '',
        handle: '',
        status: 'draft',
        metaTitle: '',
        metaDesc: '',
        images: [],
        order:0
    })

    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [uploadingImages, setUploadingImages] = useState({})

    useEffect(() => {
        if (!isNewCollection && collectionId) {
            fetchCollection()
        }
    }, [collectionId, isNewCollection])

    const fetchCollection = async () => {
        try {
            setLoading(true)
            const response = await fetch(`/api/sale-collection/get-single-collection?id=${collectionId}`)
            const data = await response.json()

            if (response.ok && data) {
                setFormData({
                    title: data.title || '',
                    handle: data.handle || '',
                    status: data.status || 'draft',
                    metaTitle: data.metaTitle || '',
                    metaDesc: data.metaDesc || '',
                    images: data.images || [],
                    order: data.order || 0
                })

            } else {
                toast.error('Collection not found')
                router.push('/sale-collections')
            }
        } catch (error) {
            console.error('Error fetching collection:', error)
            toast.error('Failed to load collection')
        } finally {
            setLoading(false)
        }
    }

    const handleInputChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }))
    }

    const handleImageUpload = async (file, imageIndex) => {
        if (!file) return

        try {
            setUploadingImages((prev) => ({ ...prev, [imageIndex]: true }))
            const uploaded = await uploadFileToS3(file, { folder: 'sale-collections' })
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
            console.error('Sale collection image upload error:', error)
            toast.error(error.message || 'Failed to upload image')
        } finally {
            setUploadingImages((prev) => ({ ...prev, [imageIndex]: false }))
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
                ? `/api/sale-collection/create-collection?token=${user?.token}`
                : `/api/sale-collection/update-collection?id=${collectionId}&token=${user?.token}`

            const method = isNewCollection ? 'POST' : 'PUT'

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            })

            if (response.ok) {
                const action = isNewCollection ? 'Created a Collection' : 'Updated a Collection'
                await createHistory(action)
                toast.success(`Collection ${isNewCollection ? 'created' : 'updated'} successfully!`)

                if (isNewCollection) {
                    router.push('/sale-collections')
                }
            } else {
                toast.error(`Unable to ${isNewCollection ? 'create' : 'update'} collection`)
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
            const response = await fetch(`/api/sale-collection/delete-collection?id=${collectionId}&token=${user?.token}`, {
                method: 'DELETE'
            })

            if (response.ok) {
                await createHistory('Deleted a Collection')
                toast.success('Collection deleted successfully')
                router.push('/sale-collections')
            } else {
                toast.error('Unable to delete collection')
            }
        } catch (error) {
            console.error('Error deleting collection:', error)
            toast.error('Unable to delete collection')
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
                    <h1>{isNewCollection ? 'Create Collection' : formData.title}</h1>
                    <p>{isNewCollection ? 'Add a new product collection' : 'Manage collection details and products'}</p>
                </div>

                <div className={styles.actionButtons}>
                    {!isNewCollection && (
                        <button onClick={deleteCollection} className={styles.deleteButton}>
                            <Trash2 size={16} />
                            Delete
                        </button>
                    )}
                    <button onClick={saveCollection} className={styles.saveButton} disabled={saving}>
                        <Save size={16} />
                        {saving ? 'Saving...' : 'Save'}
                    </button>
                </div>
            </div>

            <div className={styles.content}>
                {/* Left Column - Collection Details */}
                <div className={styles.leftColumn}>
                    {/* Basic Information */}
                    <section className={styles.section}>
                        <h2>
                            <Settings size={20} />
                            Basic Information
                        </h2>
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
                                <label>Order </label>
                                <input
                                    type="number"
                                    placeholder="Collection Order"
                                    value={formData.order}
                                    onChange={(e) => handleInputChange('order', e.target.value)}
                                />
                            </div>
                        </div>
                    </section>

                    {/* Images */}
                    <section className={styles.section}>
                        <h2>
                            <Image size={20} />
                            Collection Images
                        </h2>
                        <div className={styles.imagesGrid}>
                            {[0, 1].map((index) => (
                                <div key={index} className={styles.imageUpload}>
                                    {formData.images[index] ? (
                                        <div className={styles.imagePreview}>
                                            <img src={formData.images[index].url} alt={`Collection ${index + 1}`} />
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

                    {/* SEO Information */}
                    <section className={styles.section}>
                        <h2>
                            <BarChart3 size={20} />
                            SEO Information
                        </h2>
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

                {/* Right Column - Settings & Products */}
                <div className={styles.rightColumn}>
                    {/* Collection Settings */}
                    <section className={styles.section}>
                        <h2>
                            <Settings size={20} />
                            Collection Settings
                        </h2>
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
                        </div>
                    </section>
                </div>
            </div>
        </div>
    )
}

export default CollectionDetail
