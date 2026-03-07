"use client"
import React, { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSelector } from 'react-redux'
import styles from '../blogs.module.css'
import { 
  ArrowLeft, Save, Eye, Edit, Trash2, Upload, X, 
  Calendar, TrendingUp, FileText, Globe, Settings 
} from 'lucide-react'
import { CldUploadWidget } from 'next-cloudinary'
import dynamic from "next/dynamic"
import { EditorState, ContentState, convertToRaw } from "draft-js"
import draftToHtml from "draftjs-to-html"
const htmlToDraft = typeof window === "object" ? require("html-to-draftjs").default : null
const Editor = dynamic(
  () => import("react-draft-wysiwyg").then((mod) => mod.Editor),
  { ssr: false }
)
import "react-draft-wysiwyg/dist/react-draft-wysiwyg.css"
import toast from 'react-hot-toast'

const BlogDetailPage = () => {
  const params = useParams()
  const router = useRouter()
  const blogId = params.id
  const user = useSelector((state) => state.auth.user)
  
  const [blog, setBlog] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  
  // Form state
  const [formData, setFormData] = useState({
    title: '',
    handle: '',
    metaTitle: '',
    metaDesc: '',
    description: '',
    state: 'draft',
    image: null
  })
  
  const [editorState, setEditorState] = useState(EditorState.createEmpty())

  useEffect(() => {
    if (blogId && blogId !== 'create') {
      fetchBlog()
    } else if (blogId === 'create') {
      setIsEditing(true)
      setLoading(false)
    }
  }, [blogId])

  const fetchBlog = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/blogs/get-blog?id=${blogId}`)
      const data = await response.json()
      
      if (response.ok && data) {
        setBlog(data)
        setFormData({
          title: data.title || '',
          handle: data.handle || '',
          metaTitle: data.metaTitle || '',
          metaDesc: data.metaDesc || '',
          description: data.description || '',
          state: data.state || 'draft',
          image: data.image || null
        })
        updateEditorState(data.description)
      } else {
        toast.error('Blog not found')
        router.push('/blogs')
      }
    } catch (error) {
      console.error('Error fetching blog:', error)
      toast.error('Failed to load blog')
    } finally {
      setLoading(false)
    }
  }

  const updateEditorState = (description) => {
    if (htmlToDraft && description) {
      try {
        const contentBlock = htmlToDraft(description)
        const initialContentState = contentBlock
          ? ContentState.createFromBlockArray(contentBlock.contentBlocks)
          : ContentState.createFromText("")
        setEditorState(EditorState.createWithContent(initialContentState))
      } catch (error) {
        console.error('Error updating editor:', error)
        setEditorState(EditorState.createEmpty())
      }
    }
  }

  const onEditorStateChange = (newState) => {
    setEditorState(newState)
    const rawContent = convertToRaw(newState.getCurrentContent())
    const htmlContent = draftToHtml(rawContent)
    setFormData(prev => ({ ...prev, description: htmlContent }))
  }

  const handleInputChange = (field, value) => {
    if(field === "title"){
      const handle = value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
      setFormData(prev => ({...prev,handle}));
    }
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleImageUpload = (result) => {
    const newImage = result.info.secure_url
    setFormData(prev => ({ ...prev, image: newImage }))
  }

  const removeImage = () => {
    setFormData(prev => ({ ...prev, image: null }))
  }

  const saveBlog = async () => {
    if (!formData.title || !formData.handle || !formData.description) {
      toast.error('Please fill in all required fields')
      return
    }

    if (!user?.token) {
      toast.error('Authentication required')
      return
    }

    try {
      setSaving(true)
      
      if (blogId === 'create') {
        // Create new blog
        const response = await fetch('/api/blogs/create-blog', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token: user.token,
            data: formData
          })
        })

        if (response.ok) {
          await createHistory('Blog Created')
          toast.success('Blog created successfully')
          const newBlog = await response.json()
          router.push(`/blogs/${newBlog._id}`)
        } else {
          toast.error('Failed to create blog')
        }
      } else {
        // Update existing blog
        const response = await fetch('/api/blogs/update-blog', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: blogId,
            token: user.token,
            data: formData
          })
        })

        if (response.ok) {
          await createHistory('Blog Updated')
          toast.success('Blog updated successfully')
          setIsEditing(false)
          fetchBlog()
        } else {
          toast.error('Failed to update blog')
        }
      }
    } catch (error) {
      console.error('Error saving blog:', error)
      toast.error('Failed to save blog')
    } finally {
      setSaving(false)
    }
  }

  const deleteBlog = async () => {
    if (!window.confirm('Are you sure you want to delete this blog?')) return

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
        await createHistory('Blog Deleted')
        toast.success('Blog deleted successfully')
        router.push('/blogs')
      } else {
        toast.error('Failed to delete blog')
      }
    } catch (error) {
      console.error('Error deleting blog:', error)
      toast.error('Failed to delete blog')
    }
  }

  const createHistory = async (action) => {
    try {
      await fetch('/api/history/create-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: user?.firstname,
          title: formData.title,
          sku: formData.handle,
          productchange: action,
          time: new Date()
        })
      })
    } catch (error) {
      console.error('Error creating history:', error)
    }
  }

  const modifyCloudinaryUrl = (url) => {
    if (!url) return '/placeholder-blog.jpg'
    const urlParts = url.split('/upload/')
    return `${urlParts[0]}/upload/c_limit,h_600,f_auto,q_70/${urlParts[1]}`
  }

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner}></div>
        <p>Loading blog...</p>
      </div>
    )
  }

  const isNewBlog = blogId === 'create'

  return (
    <div className={styles.blogDetailPage}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <h1>
            {isNewBlog ? 'Create New Blog' : 
             isEditing ? 'Edit Blog' : formData.title}
          </h1>
          <p>
            {isNewBlog ? 'Write a new blog post' : 
             isEditing ? 'Update blog content and settings' : 'Manage blog post'}
          </p>
        </div>

        <div className={styles.headerActions}>
          {!isNewBlog && !isEditing && (
            <>
              <button 
                onClick={() => window.open(`/blog/${formData.handle}`, '_blank')}
                className={styles.secondaryButton}
              >
                <Eye size={16} />
                View Live
              </button>
              <button 
                onClick={() => setIsEditing(true)}
                className={styles.primaryButton}
              >
                <Edit size={16} />
                Edit Blog
              </button>
            </>
          )}
          
          {isEditing && (
            <>
              <button 
                onClick={isNewBlog ? saveBlog : () => setIsEditing(false)}
                className={styles.secondaryButton}
                disabled={saving}
              >
                Cancel
              </button>
              <button 
                onClick={saveBlog}
                className={styles.primaryButton}
                disabled={saving}
              >
                <Save size={16} />
                {saving ? 'Saving...' : isNewBlog ? 'Create Blog' : 'Save Changes'}
              </button>
            </>
          )}

          {!isNewBlog && !isEditing && (
            <button 
              onClick={deleteBlog}
              className={styles.deleteButton}
            >
              <Trash2 size={16} />
              Delete
            </button>
          )}
        </div>
      </div>

      <div className={styles.blogContent}>
        {/* Main Content */}
        <div className={styles.mainContent}>
          {isEditing ? (
            /* Edit Mode */
            <>
              <div className={styles.section}>
                <h2>Blog Content</h2>
                <div className={styles.formGroup}>
                  <label>Title *</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => handleInputChange('title', e.target.value)}
                    placeholder="Enter blog title"
                  />
                </div>
                
                <div className={styles.formGroup}>
                  <label>Handle *</label>
                  <input
                    type="text"
                    value={formData.handle}
                    onChange={(e) => handleInputChange('handle', e.target.value)}
                    placeholder="blog-handle"
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>Description *</label>
                  <Editor
                    editorStyle={{
                      height: '400px',
                      border: '1px solid #e2e8f0',
                      padding: '1rem',
                      borderRadius: '8px'
                    }}
                    editorState={editorState}
                    onEditorStateChange={onEditorStateChange}
                    toolbar={{
                      options: ['inline', 'blockType', 'fontSize', 'list', 'textAlign', 'link', 'emoji', 'history'],
                      inline: { options: ['bold', 'italic', 'underline'] },
                      list: { options: ['unordered', 'ordered'] },
                      textAlign: { options: ['left', 'center', 'right', 'justify'] },
                      link: { showOpenOptionOnHover: true },
                    }}
                  />
                </div>
              </div>
            </>
          ) : (
            /* View Mode */
            <>
              <div className={styles.section}>
                <div className={styles.blogHeader}>
                  <h2>{formData.title}</h2>
                  <span className={`${styles.status} ${formData.state === 'active' ? styles.active : styles.draft}`}>
                    {formData.state}
                  </span>
                </div>
                
                {formData.image&& (
                  <div className={styles.blogImage}>
                    <img 
                      src={modifyCloudinaryUrl(formData.image)} 
                      alt={formData.title}
                    />
                  </div>
                )}

                <div 
                  className={styles.blogDescription}
                  dangerouslySetInnerHTML={{ __html: formData.description }}
                />
              </div>
            </>
          )}
        </div>

        {/* Sidebar */}
        <div className={styles.sidebar}>
          {isEditing ? (
            /* Edit Sidebar */
            <>
              <div className={styles.section}>
                <h2>
                  <Settings size={20} />
                  Blog Settings
                </h2>
                
                <div className={styles.formGroup}>
                  <label>Status</label>
                  <select
                    value={formData.state}
                    onChange={(e) => handleInputChange('state', e.target.value)}
                  >
                    <option value="draft">Draft</option>
                    <option value="active">Active</option>
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label>Featured Image</label>
                  {formData.image? (
                    <div className={styles.imagePreview}>
                      <img 
                        src={modifyCloudinaryUrl(formData.image)} 
                        alt="Featured"
                      />
                      <button onClick={removeImage} className={styles.removeImage}>
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <CldUploadWidget
                      signatureEndpoint="/api/upload/upload-img"
                      onSuccess={handleImageUpload}
                    >
                      {({ open }) => (
                        <button onClick={open} className={styles.uploadButton}>
                          <Upload size={20} />
                          Upload Image
                        </button>
                      )}
                    </CldUploadWidget>
                  )}
                </div>
              </div>

              <div className={styles.section}>
                <h2>
                  <Globe size={20} />
                  SEO Settings
                </h2>
                
                <div className={styles.formGroup}>
                  <label>Meta Title</label>
                  <input
                    type="text"
                    value={formData.metaTitle}
                    onChange={(e) => handleInputChange('metaTitle', e.target.value)}
                    placeholder="Meta title for SEO"
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>Meta Description</label>
                  <textarea
                    value={formData.metaDesc}
                    onChange={(e) => handleInputChange('metaDesc', e.target.value)}
                    placeholder="Meta description for SEO"
                    rows={4}
                  />
                </div>
              </div>
            </>
          ) : (
            /* View Sidebar */
            <>
              <div className={styles.section}>
                <h2>
                  <FileText size={20} />
                  Blog Info
                </h2>
                
                <div className={styles.infoItem}>
                  <label>Handle</label>
                  <span>/{formData.handle}</span>
                </div>

                <div className={styles.infoItem}>
                  <label>Status</label>
                  <span className={`${styles.status} ${formData.state === 'active' ? styles.active : styles.draft}`}>
                    {formData.state}
                  </span>
                </div>

                <div className={styles.infoItem}>
                  <label>Created</label>
                  <span>
                    <Calendar size={14} />
                    {blog ? new Date(blog.createdAt).toLocaleDateString() : 'N/A'}
                  </span>
                </div>

                <div className={styles.infoItem}>
                  <label>Views</label>
                  <span>
                    <TrendingUp size={14} />
                    {blog?.numViews || 0}
                  </span>
                </div>
              </div>

              {formData.metaTitle && (
                <div className={styles.section}>
                  <h2>
                    <Globe size={20} />
                    SEO Info
                  </h2>
                  
                  <div className={styles.infoItem}>
                    <label>Meta Title</label>
                    <span>{formData.metaTitle}</span>
                  </div>

                  {formData.metaDesc && (
                    <div className={styles.infoItem}>
                      <label>Meta Description</label>
                      <span>{formData.metaDesc}</span>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}


export default BlogDetailPage
