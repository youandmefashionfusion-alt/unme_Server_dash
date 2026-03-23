"use client"
import React, { useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import styles from './Collections.module.css'
import { Plus, Image, Package, Edit, Trash2, Eye } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

const CollectionsPage = () => {
    const [collections, setCollections] = useState([])
    const [loading, setLoading] = useState(true)
    const {user} = useSelector((state) => state.auth)
    const router = useRouter()

    useEffect(() => {
        fetchCollections()
    }, [])

    const fetchCollections = async () => {
        try {
            setLoading(true)
            const response = await fetch('/api/collection/getallcollections', { cache: 'no-store' })
            const data = await response.json()
            if (response.ok) {
                setCollections(data.collections || data)
            } else {
                console.error("Unable to fetch Collections")
            }
        } catch (error) {
            console.error("Error fetching collections:", error)
        } finally {
            setLoading(false)
        }
    }

    const deleteCollection = async (collectionId, collectionName) => {
        if (!window.confirm(`Are you sure you want to delete "${collectionName}"?`)) return

        try {
            const response = await fetch(`/api/collection/delete-collection?id=${collectionId}&token=${user?.token}`, {
                method: "DELETE",
            })

            if (response.ok) {
                // Create history record
                await fetch("/api/history/create-history", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        name: user?.firstname,
                        title: collectionName,
                        productchange: "Deleted a Collection",
                        time: new Date()
                    }),
                })
                
                toast.success("Collection deleted successfully")
                fetchCollections() // Refresh the list
            } else {
                toast.error("Unable to delete collection")
            }
        } catch (error) {
            console.error("Error deleting collection:", error)
            toast.error("Unable to delete collection")
        }
    }

    const modifyCloudinaryUrl = (url) => {
        if (!url) return '/placeholder-image.jpg'
        const cloudfront = process.env.NEXT_PUBLIC_CLOUDFRONT_URL || 'https://d2gtpgxs0y565n.cloudfront.net';
        
        // Check if it's an S3 URL - convert to CloudFront
        if (url.includes('s3.') || url.includes('amazonaws.com')) {
            try {
                const urlObj = new URL(url);
                const pathname = urlObj.pathname;
                return `${cloudfront}${pathname}`;
            } catch (e) {
                return url;
            }
        }
        
        // Apply Cloudinary transformations for Cloudinary URLs
        const urlParts = url.split('/upload/')
        if (urlParts.length === 2) {
            return `${urlParts[0]}/upload/c_limit,h_300,f_auto,q_60/${urlParts[1]}`
        }
        return url
    }

    if (loading) {
        return (
            <div className={styles.loading}>
                <div className={styles.spinner}></div>
                <p>Loading collections...</p>
            </div>
        )
    }

    return (
        <div className={styles.container}>
            {/* Header */}
            <div className={styles.header}>
                <div className={styles.headerContent}>
                    <h1>Collections</h1>
                    <p>Manage your product collections</p>
                </div>
                <Link href="/collections/new" className={styles.createButton}>
                    <Plus size={20} />
                    New Collection
                </Link>
            </div>

            {/* Collections Grid */}
            <div className={styles.collectionsGrid}>
                {collections?.length === 0 ? (
                    <div className={styles.emptyState}>
                        <Package size={48} />
                        <h3>No collections found</h3>
                        <p>Create your first collection to get started</p>
                        <Link href="/collections/new" className={styles.createButton}>
                            <Plus size={20} />
                            Create Collection
                        </Link>
                    </div>
                ) : (
                    collections?.sort((a, b) => (a?.order ?? Infinity) - (b?.order ?? Infinity))?.map((collection) => (
                        <div key={collection._id} className={styles.collectionCard}>
                            {/* Collection Images */}
                            <div className={styles.collectionImages}>
                                {collection.images?.[0] ? (
                                    <img 
                                        src={modifyCloudinaryUrl(collection.images[0]?.url)} 
                                        alt={collection.title}
                                        className={styles.mainImage}
                                    />
                                ) : (
                                    <div className={styles.imagePlaceholder}>
                                        <Image size={32} />
                                    </div>
                                )}
                                
                                {collection.images?.[1] ? (
                                    <img 
                                        src={modifyCloudinaryUrl(collection.images[1]?.url)} 
                                        alt={collection.title}
                                        className={styles.secondaryImage}
                                    />
                                ) : (
                                    <div className={styles.imagePlaceholder}>
                                        <Image size={24} />
                                    </div>
                                )}
                            </div>

                            {/* Collection Info */}
                            <div className={styles.collectionInfo}>
                                <h3 className={styles.collectionTitle}>{collection.title}</h3>
                                <p className={styles.collectionHandle}>{collection.handle}</p>
                                <div className={styles.collectionMeta}>
                                    <span className={styles.productCount}>
                                        {collection.productCount || 0} products
                                    </span>
                                    <span className={`${styles.status} ${styles[collection.status]}`}>
                                        {collection.status}
                                    </span>
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className={styles.actionButtons}>
                                <button 
                                    onClick={() => router.push(`/collections/${collection._id}`)}
                                    className={styles.editBtn}
                                    title="Edit collection"
                                >
                                    <Edit size={16} />
                                </button>
                                <button 
                                    onClick={() =>  router.push(`/collections/${collection._id}`)}
                                    className={styles.viewBtn}
                                    title="View collection"
                                >
                                    <Eye size={16} />
                                </button>
                                <button 
                                    onClick={() => deleteCollection(collection._id, collection.title)}
                                    className={styles.deleteBtn}
                                    title="Delete collection"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}

export default CollectionsPage
