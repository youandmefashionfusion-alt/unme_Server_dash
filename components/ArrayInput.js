import React from 'react';
import { Plus, X, Tag } from 'lucide-react';
import styles from '../src/app/products/Products.module.css';

const ArrayInput = React.memo(({ 
  title, 
  field, 
  items = [], 
  inputValue, 
  onInputChange, 
  onAdd, 
  onRemove,
  placeholder = `Add ${field}`
}) => {
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      e.preventDefault();
      onAdd(field, inputValue);
    }
  };

  return (
    <div className={styles.arraySection}>
      <label className={styles.arrayLabel}>{title}</label>
      <div className={styles.arrayInputGroup}>
        <input
          type="text"
          placeholder={placeholder}
          value={inputValue}
          onChange={(e) => onInputChange(field, e.target.value)}
          onKeyDown={handleKeyDown}
          className={styles.arrayInput}
        />
        <button
          onClick={() => onAdd(field, inputValue)}
          className={styles.arrayAddBtn}
          disabled={!inputValue.trim()}
          type="button"
        >
          <Plus size={16} />
        </button>
      </div>

      <div className={styles.arrayTags}>
        {items.map((item, index) => (
          <span key={`${field}-${index}-${item}`} className={styles.tag}>
            <Tag size={12} />
            <span className={styles.tagText}>{item}</span>
            <button
              onClick={() => onRemove(field, index)}
              className={styles.tagRemove}
              type="button"
            >
              <X size={12} />
            </button>
          </span>
        ))}
        {items.length === 0 && (
          <span className={styles.tagEmpty}>No {field} added</span>
        )}
      </div>
    </div>
  );
});

ArrayInput.displayName = 'ArrayInput';
export default ArrayInput;