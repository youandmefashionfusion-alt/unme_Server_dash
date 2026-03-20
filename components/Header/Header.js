'use client';
import { useState, useEffect } from 'react';
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
  ChevronRight,
  LogOut,
  Bell
} from 'lucide-react';
import { useDispatch } from 'react-redux';
import { logoutUser } from '@/lib/slices/authSlice';
import styles from './Header.module.css';
import logo from '../../images/logo.png'
import { useSelector } from 'react-redux';
const Header = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const pathname = usePathname();
  const dispatch = useDispatch();

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

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

  const isActive = (href) => {
    if (href === '/') {
      return pathname === href;
    }
    return pathname.startsWith(href);
  };
  const {user} = useSelector((state)=>state?.auth)

  return (
    <>
      {/* Top Navigation */}
      <header className={styles.topHeader}>
        <div className={styles.topHeaderLeft}>
          <button 
            className={styles.menuTrigger}
            onClick={() => setIsMobileMenuOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
          
          <div className={styles.pageTitle}>
            {menuItems.find(item => isActive(item.href))?.name || 'Dashboard'}
          </div>
        </div>

        <div className={styles.topHeaderRight}>
          <button className={styles.notificationBtn} aria-label="Notifications">
            <Bell size={18} />
            <span className={styles.notificationBadge}>3</span>
          </button>

          <div className={styles.userMenu}>
            <div className={styles.userAvatar}>
              <span>{user?.firstname?.[0] || "A"}</span>
            </div>
            <div className={styles.userInfo}>
              <span className={styles.userName}>{user?.firstname || "Admin"}</span>
              <span className={styles.userRole}>{user?.role ? user.role.toUpperCase() : "ADMIN"}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Sidebar */}
      <aside 
        className={`${styles.sidebar} ${isMobileMenuOpen ? styles.mobileOpen : ''} ${
          isCollapsed ? styles.collapsed : ''
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
            onClick={() => setIsCollapsed(!isCollapsed)}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
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
                    {!isCollapsed && (
                      <span className={styles.navLabel}>{item.name}</span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className={styles.sidebarFooter}>
          <button 
            className={styles.logoutBtn}
            onClick={() => dispatch(logoutUser())}
          >
            <LogOut size={20} />
            {!isCollapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Mobile Overlay */}
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
