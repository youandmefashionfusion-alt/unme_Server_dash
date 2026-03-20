'use client';
import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { Lock, Phone, Eye, EyeOff } from 'lucide-react';
import { loginUser } from '../../src/lib/slices/authSlice';
import styles from './AdminLogin.module.css';
import Image from 'next/image';
import logo from '../../images/logo.png'

const AdminLogin = () => {
  const dispatch = useDispatch();

  const [formData, setFormData] = useState({
    number: '',
    password: '',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    let updatedValue = value;

    if (name === 'number') {
      updatedValue = value.replace(/\D/g, '');
      if (updatedValue.length > 10) updatedValue = updatedValue.slice(0, 10);
    }

    setFormData((prev) => ({
      ...prev,
      [name]: updatedValue,
    }));

    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (formData.number.length !== 10) {
      setError('Please enter a valid 10-digit phone number');
      setLoading(false);
      return;
    }

    if (!formData.password) {
      setError('Please enter your password');
      setLoading(false);
      return;
    }

    try {
      await dispatch(loginUser({
        mobile: formData.number,
        password: formData.password
      })).unwrap();
      // router.push('/admin');
    } catch (err) {
      setError(err || 'Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.loginContainer}>
      {/* Premium background with subtle pattern */}
      <div className={styles.backgroundGradient}></div>
      <div className={styles.patternOverlay}></div>

      <div className={styles.loginCard}>
        {/* Brand Section */}
        <div className={styles.brandSection}>
          <div className={styles.logoWrapper}>
            <Image src={logo} alt='UnMe Logo' width={500} height={200} />
          </div>
          <h2 className={styles.welcomeText}>Welcome back</h2>
          <p className={styles.subtitle}>Sign in to your admin dashboard</p>
        </div>

        {/* Form */}
        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          {error && (
            <div className={styles.errorAlert}>
              <span className={styles.errorIcon}>!</span>
              <p>{error}</p>
            </div>
          )}

          <div className={styles.formGroup}>
            <label htmlFor="number" className={styles.label}>
              Phone Number
            </label>
            <div className={styles.inputWrapper}>
              <Phone className={styles.inputIcon} size={18} />
              <input
                type="text"
                id="number"
                name="number"
                value={formData.number}
                onChange={handleChange}
                placeholder="10-digit mobile number"
                className={styles.input}
                inputMode="numeric"
                maxLength={10}
                required
                autoComplete="tel"
              />
            </div>
          </div>

          <div className={styles.formGroup}>
            <div className={styles.labelRow}>
              <label htmlFor="password" className={styles.label}>
                Password
              </label>
              <a href="#" className={styles.forgotLink}>
                Forgot?
              </a>
            </div>
            <div className={styles.inputWrapper}>
              <Lock className={styles.inputIcon} size={18} />
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Enter your password"
                className={styles.input}
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                className={styles.togglePassword}
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label="Toggle password visibility"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div className={styles.checkboxRow}>
            <label className={styles.checkboxLabel}>
              <input type="checkbox" className={styles.checkbox} />
              <span>Keep me signed in</span>
            </label>
          </div>

          <button
            type="submit"
            className={styles.submitButton}
            disabled={loading}
          >
            {loading ? (
              <>
                <div className={styles.buttonSpinner}></div>
                Signing in...
              </>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        {/* Footer */}
        <div className={styles.footer}>
          <p>© {new Date().getFullYear()} UnMe Jewels. Secure admin access.</p>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;
