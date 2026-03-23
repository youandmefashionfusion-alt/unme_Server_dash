import { useState } from 'react';
import { Search, Plus } from 'lucide-react';
import styles from '../src/app/orders/orders.module.css';
import toast from 'react-hot-toast';

const ProductSearch = ({ onAddProduct }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [show, setShow] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;
    
    setLoading(true);
    try {
      const res = await fetch(`/api/products/search?search=${query}`);
      const data = await res.json();
      
      if (data.success) {
        setResults(data.products || []);
        setShow(true);
      }
    } catch (error) {
      toast.error('Search failed');
    } finally {
      setLoading(false);
    }
  };

  const modifyImageUrl = (url) => {
    if (!url) return '/placeholder.jpg';
    const cloudfront = process.env.NEXT_PUBLIC_CLOUDFRONT_URL || process.env.CLOUDFRONT_URL || 'https://d2gtpgxs0y565n.cloudfront.net';
    
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
    const parts = url.split('/upload/');
    if (parts.length === 2) {
      return `${parts[0]}/upload/c_limit,h_80,f_auto,q_60/${parts[1]}`;
    }
    
    return url; // Fallback to original URL
  };

  return (
    <div className={styles.searchWrapper}>
      <div className={styles.searchGroup}>
        <div className={styles.searchField}>
          <Search size={18} className={styles.searchIcon} />
          <input
            type="text"
            placeholder="Search by name or SKU..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className={styles.searchInput}
          />
        </div>
        <button 
          onClick={handleSearch} 
          className={styles.searchBtn}
          disabled={loading}
        >
          {loading ? '...' : 'Search'}
        </button>
      </div>

      {show && results.length > 0 && (
        <div className={styles.searchResults}>
          {results.map((product) => (
            <div key={product._id} className={styles.resultItem}>
              <img 
                src={modifyImageUrl(product.images?.[0]?.url)} 
                alt={product.title}
                className={styles.resultImage}
              />
              <div className={styles.resultInfo}>
                <h4>{product.title}</h4>
                <p>SKU: {product.sku}</p>
                <span className={styles.resultPrice}>₹{product.price}</span>
              </div>
              <button 
                onClick={() => onAddProduct(product)}
                className={styles.addBtn}
              >
                <Plus size={16} />
                Add
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProductSearch;