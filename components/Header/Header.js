'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import {
  Home,
  Package,
  Layers,
  ShoppingCart,
  FileText,
  Image as ImageIcon,
  Users,
  Tag,
  Star,
  Settings,
  Menu,
  X,
  ChevronLeft,
  ChevronDown,
  LogOut,
  Bell,
  RefreshCw,
} from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { logoutUser } from '@/lib/slices/authSlice';
import styles from './Header.module.css';
import logo from '../../images/logo.png';

const NOTIFICATION_REFRESH_INTERVAL = 120000;

const safeCount = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

const buildDashboardNotifications = (filters = {}) => {
  const pendingCount = safeCount(filters?.pending?.count);
  const arrivingCount = safeCount(filters?.arriving?.count);
  const cancelledCount = safeCount(filters?.cancelled?.count);
  const returnedCount = safeCount(filters?.returned?.count);
  const items = [];

  if (pendingCount > 0) {
    items.push({
      id: 'pending-orders',
      tone: 'warning',
      count: pendingCount,
      title: 'Pending Orders',
      description: `${pendingCount} order${pendingCount > 1 ? 's are' : ' is'} waiting for confirmation.`,
      href: '/orders',
    });
  }

  if (arrivingCount > 0) {
    items.push({
      id: 'arriving-orders',
      tone: 'info',
      count: arrivingCount,
      title: 'Arriving Orders',
      description: `${arrivingCount} shipment${arrivingCount > 1 ? 's are' : ' is'} marked as arriving.`,
      href: '/orders',
    });
  }

  if (cancelledCount > 0) {
    items.push({
      id: 'cancelled-orders',
      tone: 'danger',
      count: cancelledCount,
      title: 'Cancelled Orders',
      description: `${cancelledCount} order${cancelledCount > 1 ? 's were' : ' was'} cancelled and may need review.`,
      href: '/orders',
    });
  }

  if (returnedCount > 0) {
    items.push({
      id: 'returned-orders',
      tone: 'warning',
      count: returnedCount,
      title: 'Returned Orders',
      description: `${returnedCount} return${returnedCount > 1 ? 's have' : ' has'} been logged.`,
      href: '/orders',
    });
  }

  if (items.length === 0) {
    items.push({
      id: 'no-alerts',
      tone: 'success',
      count: 0,
      title: 'All Caught Up',
      description: 'No urgent dashboard alerts right now.',
      href: '/orders',
    });
  }

  return items;
};

const menuItems = [
  { name: 'Dashboard', href: '/', icon: Home },
  { name: 'Products', href: '/products', icon: Package },
  { name: 'Collections', href: '/collections', icon: Layers },
  { name: 'Sale Collections', href: '/sale-collections', icon: Layers },
  { name: 'Orders', href: '/orders', icon: ShoppingCart },
  { name: 'Abandoneds', href: '/abandoned', icon: ShoppingCart },
  { name: 'Blogs', href: '/blogs', icon: FileText },
  { name: 'Banners', href: '/banners', icon: ImageIcon },
  { name: 'Users', href: '/users', icon: Users },
  { name: 'Coupons', href: '/coupons', icon: Tag },
  { name: 'Ratings', href: '/ratings', icon: Star },
  { name: 'Settings', href: '/settings', icon: Settings },
];

const Header = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotificationLoading, setIsNotificationLoading] = useState(false);
  const [notificationError, setNotificationError] = useState('');
  const [notificationUpdatedAt, setNotificationUpdatedAt] = useState('');
  const [notifications, setNotifications] = useState([]);

  const pathname = usePathname();
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state?.auth ?? {});

  const notificationRef = useRef(null);
  const profileRef = useRef(null);
  const mountedRef = useRef(false);

  const isActive = useCallback(
    (href) => {
      if (href === '/') {
        return pathname === href;
      }
      return pathname.startsWith(href);
    },
    [pathname]
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const saved = window.localStorage.getItem('admin-sidebar-collapsed');
    if (saved === 'true') {
      setIsSidebarCollapsed(true);
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('admin-sidebar-collapsed', String(isSidebarCollapsed));
    }
    document.body.classList.toggle('sidebar-hidden', isSidebarCollapsed);
  }, [isSidebarCollapsed]);

  useEffect(() => {
    return () => {
      document.body.classList.remove('sidebar-hidden');
    };
  }, []);

  useEffect(() => {
    setIsMobileMenuOpen(false);
    setIsNotificationOpen(false);
    setIsProfileOpen(false);
  }, [pathname]);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setIsNotificationOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setIsProfileOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setIsNotificationOpen(false);
        setIsProfileOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick);
    window.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
      window.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const fetchNotifications = useCallback(async (silent = false) => {
    if (!silent && mountedRef.current) {
      setIsNotificationLoading(true);
    }

    try {
      const response = await fetch('/api/user/getallorders?limit=1&page=1', {
        cache: 'no-store',
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || 'Failed to load notifications');
      }

      if (!mountedRef.current) {
        return;
      }

      setNotifications(buildDashboardNotifications(data?.filters));
      setNotificationUpdatedAt(new Date().toISOString());
      setNotificationError('');
    } catch (error) {
      console.error('Failed to fetch header notifications:', error);
      if (!mountedRef.current) {
        return;
      }
      setNotificationError('Unable to refresh alerts right now.');
      if (!silent) {
        setNotifications((prev) => {
          if (prev.length > 0) {
            return prev;
          }
          return buildDashboardNotifications();
        });
      }
    } finally {
      if (!silent && mountedRef.current) {
        setIsNotificationLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void fetchNotifications(false);
    const intervalId = window.setInterval(() => {
      void fetchNotifications(true);
    }, NOTIFICATION_REFRESH_INTERVAL);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [fetchNotifications]);

  const handleMenuTrigger = () => {
    const isDesktop = typeof window !== 'undefined' && window.innerWidth > 1024;
    if (isDesktop) {
      setIsSidebarCollapsed((prev) => !prev);
      return;
    }
    setIsMobileMenuOpen(true);
  };

  const handleToggleNotifications = () => {
    setIsProfileOpen(false);
    setIsNotificationOpen((prev) => !prev);
  };

  const handleToggleProfile = () => {
    setIsNotificationOpen(false);
    setIsProfileOpen((prev) => !prev);
  };

  const handleLogout = () => {
    setIsProfileOpen(false);
    dispatch(logoutUser());
  };

  const currentPageTitle = useMemo(
    () => menuItems.find((item) => isActive(item.href))?.name || 'Dashboard',
    [isActive]
  );

  const notificationBadgeCount = useMemo(
    () => notifications.reduce((sum, item) => sum + safeCount(item?.count), 0),
    [notifications]
  );

  const notificationUpdatedLabel = useMemo(() => {
    if (!notificationUpdatedAt) {
      return '';
    }
    return new Date(notificationUpdatedAt).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }, [notificationUpdatedAt]);

  const userInitial = (user?.firstname?.[0] || 'A').toUpperCase();
  const userName = [user?.firstname, user?.lastname].filter(Boolean).join(' ') || 'Admin';
  const userRole = (user?.role || 'ADMIN').toUpperCase();

  const toneClassByNotification = {
    warning: styles.dotWarning,
    info: styles.dotInfo,
    danger: styles.dotDanger,
    success: styles.dotSuccess,
  };

  return (
    <>
      <header className={`${styles.topHeader} ${isSidebarCollapsed ? styles.topHeaderExpanded : ''}`}>
        <div className={styles.topHeaderLeft}>
          <button
            className={`${styles.menuTrigger} ${isSidebarCollapsed ? styles.menuTriggerVisible : ''}`}
            onClick={handleMenuTrigger}
            aria-label={isSidebarCollapsed ? 'Show sidebar' : 'Open menu'}
          >
            <Menu size={20} />
          </button>

          <div className={styles.pageTitle}>{currentPageTitle}</div>
        </div>

        <div className={styles.topHeaderRight}>
          <div className={styles.notificationWrap} ref={notificationRef}>
            <button
              className={styles.notificationBtn}
              aria-label="Notifications"
              aria-haspopup="menu"
              aria-expanded={isNotificationOpen}
              onClick={handleToggleNotifications}
            >
              <Bell size={18} />
              {notificationBadgeCount > 0 && (
                <span className={styles.notificationBadge}>
                  {notificationBadgeCount > 99 ? '99+' : notificationBadgeCount}
                </span>
              )}
            </button>

            {isNotificationOpen && (
              <div className={styles.dropdownMenu} role="menu" aria-label="Dashboard notifications">
                <div className={styles.dropdownHeader}>
                  <p className={styles.dropdownTitle}>Notifications</p>
                  <button
                    type="button"
                    className={styles.refreshBtn}
                    onClick={() => fetchNotifications(false)}
                    disabled={isNotificationLoading}
                  >
                    <RefreshCw size={14} className={isNotificationLoading ? styles.spin : ''} />
                    <span>{isNotificationLoading ? 'Refreshing' : 'Refresh'}</span>
                  </button>
                </div>

                {notificationUpdatedLabel && (
                  <p className={styles.dropdownMeta}>Updated at {notificationUpdatedLabel}</p>
                )}

                {notificationError && (
                  <p className={styles.dropdownError}>{notificationError}</p>
                )}

                <div className={styles.notificationList}>
                  {notifications.map((item) => (
                    <Link
                      key={item.id}
                      href={item.href}
                      className={styles.notificationItem}
                      onClick={() => setIsNotificationOpen(false)}
                    >
                      <span
                        className={`${styles.notificationDot} ${
                          toneClassByNotification[item.tone] || styles.dotInfo
                        }`}
                      />
                      <div className={styles.notificationContent}>
                        <span className={styles.notificationTitle}>{item.title}</span>
                        <span className={styles.notificationText}>{item.description}</span>
                      </div>
                      {safeCount(item.count) > 0 && (
                        <span className={styles.notificationCount}>{item.count}</span>
                      )}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className={styles.userMenuWrap} ref={profileRef}>
            <button
              type="button"
              className={styles.userMenu}
              aria-haspopup="menu"
              aria-expanded={isProfileOpen}
              onClick={handleToggleProfile}
            >
              <div className={styles.userAvatar}>
                <span>{userInitial}</span>
              </div>
              <div className={styles.userInfo}>
                <span className={styles.userName}>{userName}</span>
                <span className={styles.userRole}>{userRole}</span>
              </div>
              <ChevronDown
                size={16}
                className={`${styles.chevronIcon} ${isProfileOpen ? styles.chevronOpen : ''}`}
              />
            </button>

            {isProfileOpen && (
              <div className={styles.dropdownMenu} role="menu" aria-label="Profile options">
                <div className={styles.profileSummary}>
                  <div className={styles.profileAvatar}>
                    <span>{userInitial}</span>
                  </div>
                  <div className={styles.profileText}>
                    <span className={styles.profileName}>{userName}</span>
                    <span className={styles.profileRole}>{userRole}</span>
                    {user?.email && <span className={styles.profileMeta}>{user.email}</span>}
                  </div>
                </div>

                <div className={styles.profileActions}>
                  <Link
                    href="/users"
                    className={styles.profileAction}
                    onClick={() => setIsProfileOpen(false)}
                  >
                    Manage Users
                  </Link>
                  <Link
                    href="/orders"
                    className={styles.profileAction}
                    onClick={() => setIsProfileOpen(false)}
                  >
                    View Orders
                  </Link>
                  <button
                    type="button"
                    className={`${styles.profileAction} ${styles.profileActionDanger}`}
                    onClick={handleLogout}
                  >
                    Logout
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <aside
        className={`${styles.sidebar} ${isMobileMenuOpen ? styles.mobileOpen : ''} ${
          isSidebarCollapsed && !isMobileMenuOpen ? styles.sidebarHidden : ''
        }`}
      >
        <div className={styles.sidebarHeader}>
          <div className={styles.brand}>
            <div className={styles.logoWrapper}>
              <Image
                src={logo}
                alt="UnMe Jewels"
                width={500}
                height={200}
                className={styles.logo}
              />
            </div>
          </div>

          <button
            className={styles.collapseBtn}
            onClick={() => setIsSidebarCollapsed((prev) => !prev)}
            aria-label={isSidebarCollapsed ? 'Show sidebar' : 'Collapse sidebar'}
            title={isSidebarCollapsed ? 'Show sidebar' : 'Collapse sidebar'}
          >
            <ChevronLeft size={18} />
          </button>

          <button
            className={styles.mobileCloseBtn}
            onClick={() => setIsMobileMenuOpen(false)}
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        <nav className={styles.nav}>
          <ul className={styles.navList}>
            {menuItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);

              return (
                <li key={item.href} className={styles.navItem}>
                  <Link
                    href={item.href}
                    className={`${styles.navLink} ${active ? styles.active : ''}`}
                  >
                    <Icon size={20} className={styles.navIcon} />
                    <span className={styles.navLabel}>{item.name}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className={styles.sidebarFooter}>
          <button
            className={styles.logoutBtn}
            onClick={handleLogout}
          >
            <LogOut size={20} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {isMobileMenuOpen && (
        <div
          className={styles.overlay}
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
    </>
  );
};

export default Header;
