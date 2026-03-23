import React, { useRef, useState } from "react";
import { Plus, X, Move } from "lucide-react";
import toast from "react-hot-toast";
import { uploadFilesToS3 } from "../src/lib/uploadToS3";
import styles from "../src/app/products/Products.module.css";

const ImageItem = ({ src, id, index, moveImage, deleteImage, setMainImage }) => {
  const handleDragStart = (e) => {
    e.dataTransfer.setData("text/plain", index);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const dragIndex = parseInt(e.dataTransfer.getData("text/plain"), 10);
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
            onError={(e) => {
              e.target.src = "/placeholder.jpg";
            }}
          />
        )}
      </div>
      <div className={styles.imageOverlay}>
        <Move size={14} className={styles.dragHandle} />
        <button onClick={() => deleteImage(id)} className={styles.imageDelete} type="button">
          <X size={14} />
        </button>
      </div>
    </div>
  );
};

const ImageUploader = ({ images = [], onUpload, onDelete, onMove, onSetMain }) => {
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const handleSelectFiles = async (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";

    if (files.length === 0) return;

    setUploading(true);
    try {
      const uploaded = await uploadFilesToS3(files, { folder: "products" });
      const info = uploaded.map((item) => ({
        public_id: item.public_id,
        secure_url: item.secure_url || item.url,
        asset_id: item.asset_id,
      }));

      onUpload?.({ event: "success", info });
      toast.success(`Uploaded ${info.length} image${info.length > 1 ? "s" : ""}`);
    } catch (error) {
      console.error("S3 upload error:", error);
      toast.error(error.message || "Failed to upload image(s)");
    } finally {
      setUploading(false);
    }
  };

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

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          hidden
          onChange={handleSelectFiles}
        />

        <button
          onClick={() => fileInputRef.current?.click()}
          className={styles.uploadButton}
          type="button"
          disabled={uploading}
        >
          <Plus size={24} />
          <span>{uploading ? "Uploading..." : "Upload Images"}</span>
        </button>
      </div>
    </div>
  );
};

export default ImageUploader;
