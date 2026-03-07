'use client'
import React, { useEffect, useState, useCallback } from "react";
import styles from "./banners.module.css";
import { X, Save, Plus, Trash2, Eye, Upload, Monitor, Smartphone, Globe } from "lucide-react";
import Image from "next/image";
import { CldUploadWidget } from "next-cloudinary";
import toast from "react-hot-toast";
import { useSelector } from "react-redux";

const Banners = () => {
  const [activeTab, setActiveTab] = useState('desktop');
  const [banners, setBanners] = useState({
    desktop: [],
    mobile: [],
    other: [],
    budget: []
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const user = useSelector((state) => state.auth.user);

  const createEmptyBanner = useCallback(() => ({
    id: `banner-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
    url: "",
    title: "",
    subtitle: "",
    link: ""
  }), []);

  const modifyCloudinaryUrl = useCallback((url) => {
    if (!url) return '';
    const urlParts = url.split('/upload/');
    return `${urlParts[0]}/upload/c_limit,h_1000,f_auto,q_50/${urlParts[1]}`;
  }, []);

  useEffect(() => {
    const fetchBanners = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/banner/get-banners');

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        // Transform the data to match our state structure
        setBanners({
          desktop: data[0].desktopBanners || [],
          mobile: data[0].mobileBanners || [],
          other: data[0].otherBanners || [],
          budget: data[0].budgetBanners || []
        });

        // If no banners in active tab, add one
        if (data[`${activeTab}Banners`]?.length === 0) {
          setBanners(prev => ({
            ...prev,
            [activeTab]: [createEmptyBanner()]
          }));
        }
      } catch (error) {
        console.error("Error fetching banners:", error.message);
        setBanners({
          desktop: [createEmptyBanner()],
          mobile: [createEmptyBanner()],
          other: [createEmptyBanner()],
          budget: [createEmptyBanner()]
        });
      } finally {
        setLoading(false);
      }
    };

    fetchBanners();
  }, [createEmptyBanner, activeTab]);

  const handleImageUpload = useCallback((result, index) => {
    if (result?.event !== "success") return;

    setBanners(prev => ({
      ...prev,
      [activeTab]: prev[activeTab].map((banner, i) =>
        i === index ? { ...banner, url: result.info.secure_url } : banner
      )
    }));
  }, [activeTab]);

  const handleInputChange = useCallback((index, field, value) => {
    setBanners(prev => ({
      ...prev,
      [activeTab]: prev[activeTab].map((banner, i) =>
        i === index ? { ...banner, [field]: value } : banner
      )
    }));
  }, [activeTab]);

  const handleImageRemove = useCallback((index) => {
    setBanners(prev => ({
      ...prev,
      [activeTab]: prev[activeTab].map((banner, i) =>
        i === index ? { ...banner, url: "" } : banner
      )
    }));
  }, [activeTab]);

  const addNewBanner = useCallback(() => {
    setBanners(prev => ({
      ...prev,
      [activeTab]: [...prev[activeTab], createEmptyBanner()]
    }));
  }, [activeTab, createEmptyBanner]);

  const removeBanner = useCallback(async (index) => {
    const currentBanners = banners[activeTab];

    if (currentBanners.length <= 1) {
      toast.error("At least one banner is required");
      return;
    }

    // Remove from state immediately for better UX
    const updatedBanners = currentBanners.filter((_, i) => i !== index);
    setBanners(prev => ({
      ...prev,
      [activeTab]: updatedBanners
    }));

    // Also update on server
    try {
      const response = await fetch(`/api/banner/update-banners?token=${user?.token}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bannerType: activeTab,
          index
        })
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.message);
      }

      toast.success("Banner removed successfully");
    } catch (error) {
      console.error("Error deleting banner:", error);
      toast.error("Error deleting banner from server");
      // Revert if server delete fails
      setBanners(prev => ({
        ...prev,
        [activeTab]: currentBanners
      }));
    }
  }, [banners, activeTab, user?.token]);

  const saveBanners = useCallback(async () => {
    try {
      setSaving(true);

      const bannersToSave = banners[activeTab].filter(banner =>
        banner.url.trim() !== "" ||
        banner.title.trim() !== "" ||
        banner.subtitle.trim() !== "" ||
        banner.link.trim() !== ""
      );

      if (bannersToSave.length === 0) {
        toast.error("Please add at least one banner with content");
        return;
      }

      const response = await fetch(`/api/banner/update-banners?token=${user?.token}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          desktopBanners: activeTab === 'desktop' ? bannersToSave : banners.desktop,
          mobileBanners: activeTab === 'mobile' ? bannersToSave : banners.mobile,
          otherBanners: activeTab === 'other' ? bannersToSave : banners.other,
          budgetBanners: activeTab === 'budget' ? bannersToSave : banners.budget,
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast.success("Banners updated successfully!");
      } else {
        throw new Error(data.message || "Failed to update banners");
      }
    } catch (error) {
      console.error("Error updating banners:", error);
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  }, [banners, activeTab, user?.token]);

  const TabButton = ({ type, label, icon: Icon }) => (
    <button
      className={`${styles.tabButton} ${activeTab === type ? styles.activeTab : ''}`}
      onClick={() => setActiveTab(type)}
    >
      <Icon size={18} />
      {label}
      <span className={styles.tabCount}>
        ({banners[type].length})
      </span>
    </button>
  );

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner}></div>
        <p>Loading banners...</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <h1 className={styles.title}>Banner Management</h1>
          <p className={styles.subtitle}>
            Manage banners for different device types
          </p>
        </div>
        <div className={styles.headerActions}>
          <button
            onClick={addNewBanner}
            className={styles.primaryButton}
            disabled={saving}
          >
            <Plus size={18} />
            Add Banner
          </button>
          <button
            onClick={saveBanners}
            className={styles.saveButton}
            disabled={saving}
          >
            {saving ? (
              <div className={styles.spinner}></div>
            ) : (
              <Save size={18} />
            )}
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        <TabButton type="desktop" label="Desktop" icon={Monitor} />
        <TabButton type="mobile" label="Mobile" icon={Smartphone} />
        <TabButton type="other" label="Other" icon={Globe} />
        <TabButton type="budget" label="Budget" icon={Globe} />
      </div>

      {/* Banners Grid */}
      <div className={styles.bannersGrid}>
        {banners[activeTab].map((banner, index) => (
          <BannerCard
            key={banner.id || index}
            banner={banner}
            index={index}
            activeTab={activeTab}
            saving={saving}
            bannersCount={banners[activeTab].length}
            onImageUpload={handleImageUpload}
            onInputChange={handleInputChange}
            onImageRemove={handleImageRemove}
            onRemoveBanner={removeBanner}
            modifyCloudinaryUrl={modifyCloudinaryUrl}
          />
        ))}
      </div>

      {/* Empty State */}
      {banners[activeTab].length === 0 && !loading && (
        <div className={styles.emptyState}>
          <div className={styles.emptyIllustration}>
            <Upload size={48} />
          </div>
          <h3>No banners for {activeTab}</h3>
          <p>Create your first {activeTab} banner to get started</p>
          <button
            onClick={addNewBanner}
            className={styles.primaryButton}
          >
            <Plus size={18} />
            Create First Banner
          </button>
        </div>
      )}
    </div>
  );
};

const BannerCard = React.memo(({
  banner,
  index,
  activeTab,
  saving,
  bannersCount,
  onImageUpload,
  onInputChange,
  onImageRemove,
  onRemoveBanner,
  modifyCloudinaryUrl
}) => {
  const getRecommendedSize = () => {
    switch (activeTab) {
      case 'desktop': return '1200×400px';
      case 'mobile': return '800×400px';
      case 'budget': return '1200×400px';
      default: return '1000×400px';
    }
  };

  return (
    <div className={styles.bannerCard}>
      <div className={styles.cardHeader}>
        <h3>{activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Banner {index + 1}</h3>
        <div className={styles.cardActions}>
          {bannersCount > 1 && (
            <button
              onClick={() => onRemoveBanner(index)}
              className={styles.dangerButton}
              disabled={saving}
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>

      <div className={styles.uploadSection}>
        <label className={styles.sectionLabel}>
          Banner Image <span className={styles.required}>*</span>
        </label>

        {banner.url ? (
          <div className={styles.imagePreview}>
            <button
              onClick={() => onImageRemove(index)}
              className={styles.removeImageButton}
              disabled={saving}
            >
              <X size={16} />
            </button>
            <Image
              src={modifyCloudinaryUrl(banner.url)}
              alt={`${activeTab} banner ${index + 1}`}
              width={400}
              height={200}
              className={styles.previewImage}
            />
          </div>
        ) : (
          <CldUploadWidget
            signatureEndpoint="/api/upload/upload-img"
            onSuccess={(result) => onImageUpload(result, index)}
          >
            {({ open }) => (
              <button
                onClick={open}
                className={styles.uploadButton}
                disabled={saving}
              >
                <Upload size={24} />
                <span>Upload Banner Image</span>
                <span className={styles.uploadHint}>
                  Recommended: {getRecommendedSize()}
                </span>
              </button>
            )}
          </CldUploadWidget>
        )}
      </div>

      <div className={styles.contentSection}>
        <div className={styles.field}>
          <label htmlFor={`title-${activeTab}-${index}`}>Title</label>
          <input
            id={`title-${activeTab}-${index}`}
            type="text"
            placeholder="Enter banner title..."
            value={banner.title}
            onChange={(e) => onInputChange(index, 'title', e.target.value)}
            className={styles.input}
            disabled={saving}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor={`subtitle-${activeTab}-${index}`}>Subtitle</label>
          <input
            id={`subtitle-${activeTab}-${index}`}
            type="text"
            placeholder="Enter subtitle..."
            value={banner.subtitle}
            onChange={(e) => onInputChange(index, 'subtitle', e.target.value)}
            className={styles.input}
            disabled={saving}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor={`link-${activeTab}-${index}`}>Link URL</label>
          <input
            id={`link-${activeTab}-${index}`}
            type="text"
            placeholder="/collections/example"
            value={banner.link}
            onChange={(e) => onInputChange(index, 'link', e.target.value)}
            className={styles.input}
            disabled={saving}
          />
          <span className={styles.helperText}>
            Use relative URLs like "/collections/summer"
          </span>
        </div>
      </div>
    </div>
  );
});

BannerCard.displayName = 'BannerCard';

export default Banners;