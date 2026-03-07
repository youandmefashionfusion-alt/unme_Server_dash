"use client"
import React, { useState, useEffect } from 'react'
import { useSelector } from 'react-redux'
import { useRouter } from 'next/navigation'
import styles from './blogs.module.css'
import { Plus, Eye, Edit, Calendar, FileText, TrendingUp, Search } from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'

const BlogsPage = () => {
  const [blogs, setBlogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const user = useSelector((state) => state.auth.user)
  const router = useRouter()

  useEffect(() => {
    fetchBlogs()
  }, [])

  const fetchBlogs = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/blogs/get-all-blogs')
      const data = await response.json()
      
      if (response.ok) {
        setBlogs(data)
      } else {
        console.error('Unable to fetch blogs')
      }
    } catch (error) {
      console.error('Error fetching blogs:', error)
    } finally {
      setLoading(false)
    }
  }

  const deleteBlog = async (blogId, blogTitle) => {
    if (!window.confirm(`Are you sure you want to delete "${blogTitle}"?`)) return

    try {
      const response = await fetch('/api/blogs/delete-blog', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          id: blogId, 
          token: user?.token 
        })
      })

      if (response.ok) {
        await fetch('/api/history/create-history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: user?.firstname,
            title: blogTitle,
            productchange: 'Blog Deleted',
            time: new Date()
          })
        })
        
        toast.success('Blog deleted successfully')
        fetchBlogs()
      } else {
        toast.error('Failed to delete blog')
      }
    } catch (error) {
      console.error('Error deleting blog:', error)
      toast.error('Failed to delete blog')
    }
  }

  const modifyCloudinaryUrl = (url) => {
    if (!url) return '/placeholder-blog.jpg'
    const urlParts = url?.split('/upload/')
    return `${urlParts[0]}/upload/c_limit,h_300,f_auto,q_60/${urlParts[1]}`
  }

  const filteredBlogs = blogs.filter(blog =>
    blog.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    blog.handle?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner}></div>
        <p>Loading blogs...</p>
      </div>
    )
  }

  return (
    <div className={styles.blogsPage}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <h1>Blog Posts</h1>
          <p>Manage and create blog content</p>
        </div>
        <Link href="/blogs/create" className={styles.createButton}>
          <Plus size={20} />
          New Blog
        </Link>
      </div>

      {/* Search */}
      <div className={styles.searchSection}>
        <div className={styles.searchContainer}>
          <Search className={styles.searchIcon} />
          <input
            type="text"
            placeholder="Search blogs by title or handle..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={styles.searchInput}
          />
        </div>
      </div>

      {/* Blogs Grid */}
      <div className={styles.blogsGrid}>
        {filteredBlogs.length === 0 ? (
          <div className={styles.emptyState}>
            <FileText size={48} />
            <h3>No blogs found</h3>
            <p>{searchQuery ? 'Try adjusting your search terms' : 'Create your first blog post to get started'}</p>
            <Link href="/blogs/create" className={styles.createButton}>
              <Plus size={20} />
              Create Blog
            </Link>
          </div>
        ) : (
          filteredBlogs.map((blog) => (
            <div key={blog._id} className={styles.blogCard}>
              <div className={styles.blogImage}>
                <img 
                  src={modifyCloudinaryUrl(blog?.image)} 
                  alt={blog.title}
                />
                <span className={`${styles.status} ${blog.state === 'active' ? styles.active : styles.draft}`}>
                  {blog.state}
                </span>
              </div>

              <div className={styles.blogContent}>
                <h3>{blog.title}</h3>                
                <div className={styles.blogMeta}>
                  <div className={styles.metaItem}>
                    <Calendar size={14} />
                    <span>{new Date(blog.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className={styles.blogActions}>
                  <button 
                    onClick={() => router.push(`/blogs/${blog._id}`)}
                    className={styles.viewButton}
                  >
                    <Eye size={16} />
                    View
                  </button>
                  <button 
                    onClick={() => deleteBlog(blog._id, blog.title)}
                    className={styles.deleteButton}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default BlogsPage