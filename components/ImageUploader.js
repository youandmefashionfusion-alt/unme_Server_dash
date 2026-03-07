import React from 'react';
import { Plus, X, Move } from 'lucide-react';
import { CldUploadWidget } from 'next-cloudinary';
import styles from '../src/app/products/Products.module.css';

const ImageItem = ({ src, id, index, moveImage, deleteImage, setMainImage }) => {
  const handleDragStart = (e) => {
    e.dataTransfer.setData('text/plain', index);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const dragIndex = parseInt(e.dataTransfer.getData('text/plain'));
    if (dragIndex !== index) {
      moveImage(dragIndex, index);
    }
  };

  const isVideo = src?.match(/\.(mp4|webm|ogg)$/i);

  return (
    <div 
      className={styles.imageItem}
      draggable
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div className={styles.imagePreview} onClick={() => setMainImage(src)}>
        {isVideo ? (
          <video src={src} />
        ) : (
          <img 
            src={src} 
            alt="" 
            onError={(e) => { e.target.src = '/placeholder.jpg'; }}
          />
        )}
      </div>
      <div className={styles.imageOverlay}>
        <Move size={14} className={styles.dragHandle} />
        <button
          onClick={() => deleteImage(id)}
          className={styles.imageDelete}
          type="button"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
};

const ImageUploader = ({ images = [], onUpload, onDelete, onMove, onSetMain }) => {
  return (
    <div className={styles.mediaSection}>
      <div className={styles.mediaGrid}>
        {images.map((image, index) => (
          <ImageItem
            key={image.public_id || image.url || `image-${index}`}
            src={image.url}
            id={image.public_id || image.url}
            index={index}
            moveImage={onMove}
            deleteImage={onDelete}
            setMainImage={onSetMain}
          />
        ))}
        
        <CldUploadWidget
          signatureEndpoint="/api/upload/upload-img"
          onSuccess={onUpload}
          options={{
            multiple: true,
            sources: ['local', 'url', 'camera'],
            cloudName: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
            uploadPreset: process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET
          }}
        >
          {({ open }) => (
            <button
              onClick={() => open()}
              className={styles.uploadButton}
              type="button"
            >
              <Plus size={24} />
              <span>Upload Images</span>
            </button>
          )}
        </CldUploadWidget>
      </div>
    </div>
  );
};

export default ImageUploader;