'use client';

import { useEffect, useState } from 'react';
import styles from './users.module.css';
import toast from 'react-hot-toast';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Download, 
  Filter, 
  Users, 
  Shield, 
  Search,
  X,
  CheckCircle,
  Send
} from 'lucide-react';
import { useSelector } from 'react-redux';

const UsersPage = () => {
    const [users, setUsers] = useState([]);
    const [filter, setFilter] = useState('all');
    const [selectedUser, setSelectedUser] = useState({});
    const [isEditing, setIsEditing] = useState(false);
    const [popupVisible, setPopupVisible] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [otp, setOtp] = useState('');
    const [otpSent, setOtpSent] = useState(false);
    const [verified, setVerified] = useState(true);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(false);

    const currentUser = useSelector((state) => state.auth.user);

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/user/get-users');
            const data = await res.json();
            setUsers(data?.users || []);
        } catch (error) {
            console.error('Error fetching users:', error);
            toast.error('Failed to load users');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
        
        // Set default date range (last 30 days)
        const today = new Date();
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(today.getDate() - 30);
        
        setEndDate(today.toISOString().split('T')[0]);
        setStartDate(thirtyDaysAgo.toISOString().split('T')[0]);
    }, []);

    const handleDelete = async (id) => {
        if (!verified) {
            toast.error('Please verify OTP first');
            return;
        }

        try {
            await fetch(`/api/user/delete-user?id=${id}&token=${currentUser?.token}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' }
            });
            toast.success('User deleted successfully');
            fetchUsers();
            closePopup();
        } catch (error) {
            toast.error('Failed to delete user');
        }
    };

    const handleEdit = async () => {
        if (!verified) {
            toast.error('Please verify OTP first');
            return;
        }

        try {
            await fetch(`/api/user/update-user?token=${currentUser?.token}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(selectedUser),
            });
            toast.success('User updated successfully');
            fetchUsers();
            closePopup();
        } catch (error) {
            toast.error('Failed to update user');
        }
    };

    const handleCreate = async () => {

        try {
            await fetch(`/api/user/create-user?token=${currentUser?.token}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(selectedUser),
            });
            toast.success('User created successfully');
            fetchUsers();
            closePopup();
        } catch (error) {
            toast.error('Failed to create user');
        }
    };

    const openPopup = (user = {}, editing = false, creating = false) => {
        setSelectedUser(user);
        setIsEditing(editing);
        setIsCreating(creating);
        setPopupVisible(true);
        setVerified(false);
        setOtpSent(false);
        setOtp('');
    };

    const closePopup = () => {
        setPopupVisible(false);
        setSelectedUser({});
        setIsCreating(false);
        setOtp('');
        setOtpSent(false);
        setVerified(false);
    };

    const exportData = async (dataType) => {
        if (!startDate || !endDate) {
            toast.error("Please select both start and end dates");
            return;
        }
        
        if (new Date(startDate) > new Date(endDate)) {
            toast.error("Start date cannot be later than end date");
            return;
        }

        try {
            const res = await fetch(`/api/user/export-data?startDate=${startDate}&endDate=${endDate}&data=${dataType}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || 'Export failed');
            }

            const blob = await res.blob();
            const downloadUrl = URL.createObjectURL(blob);
            
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = `orders-${startDate}-to-${endDate}-${dataType}.xlsx`;
            document.body.appendChild(link);
            link.click();
            
            document.body.removeChild(link);
            URL.revokeObjectURL(downloadUrl);
            
            toast.success("Excel file downloaded successfully!");

        } catch (error) {
            console.error('Export error:', error);
            toast.error(error.message || "Failed to export data");
        }     
    };

    // Filter and search users
    const filteredUsers = users
        .filter(user => {
            // Filter by role
            if (filter === 'admin' && user.role !== 'admin') return false;
                        
            // Search filter
            if (searchTerm) {
                const searchLower = searchTerm.toLowerCase();
                return (
                    user.firstname?.toLowerCase().includes(searchLower) ||
                    user.email?.toLowerCase().includes(searchLower) ||
                    user.mobile?.includes(searchTerm) ||
                    user._id?.toLowerCase().includes(searchLower)
                );
            }
            
            return true;
        });

    const canManageAdmins = currentUser?.firstname === 'keshav';

    return (
        <div className={styles.container}>
            {/* Header */}
            <div className={styles.header}>
                <div className={styles.headerContent}>
                    <h1 className={styles.title}>User Management</h1>
                    <p className={styles.subtitle}>
                        Manage users and administrators for your platform
                    </p>
                </div>
                <button 
                    className={styles.primaryButton}
                    onClick={() => openPopup({}, false, true)}
                >
                    <Plus size={18} />
                    Create User
                </button>
            </div>

            {/* Stats Cards */}
            <div className={styles.statsGrid}>
                <div className={styles.statCard}>
                    <div className={styles.statIcon}>
                        <Users size={24} />
                    </div>
                    <div className={styles.statContent}>
                        <h3>{users.length}</h3>
                        <p>Total Users</p>
                    </div>
                </div>
                <div className={styles.statCard}>
                    <div className={styles.statIcon} style={{ background: 'rgba(139, 92, 246, 0.1)' }}>
                        <Shield size={24} style={{ color: '#8b5cf6' }} />
                    </div>
                    <div className={styles.statContent}>
                        <h3>{users.filter(u => u.role === 'admin').length}</h3>
                        <p>Administrators</p>
                    </div>
                </div>
            </div>

            {/* Controls */}
            <div className={styles.controls}>
                <div className={styles.searchBox}>
                    <Search size={18} />
                    <input
                        type="text"
                        placeholder="Search users by name, email, or ID..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className={styles.searchInput}
                    />
                </div>

                <div className={styles.controlGroup}>
                    <div className={styles.filterButtons}>
                        <button 
                            className={`${styles.filterButton} ${filter === 'all' ? styles.active : ''}`}
                            onClick={() => setFilter('all')}
                        >
                            <Users size={16} />
                            All Users
                        </button>
                        <button 
                            className={`${styles.filterButton} ${filter === 'admin' ? styles.active : ''}`}
                            onClick={() => setFilter('admin')}
                        >
                            <Shield size={16} />
                            Admins Only
                        </button>
                    </div>

                    <div className={styles.exportSection}>
                        <div className={styles.dateInputs}>
                            <div className={styles.dateGroup}>
                                <label>From</label>
                                <input 
                                    type="date" 
                                    value={startDate} 
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className={styles.dateInput}
                                />
                            </div>
                            <div className={styles.dateGroup}>
                                <label>To</label>
                                <input 
                                    type="date" 
                                    value={endDate} 
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className={styles.dateInput}
                                />
                            </div>
                        </div>
                        <div className={styles.exportButtons}>
                            <button 
                                className={styles.exportButton}
                                onClick={() => exportData("youandme")}
                            >
                                <Download size={16} />
                                Export Data
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Users Table */}
            <div className={styles.tableContainer}>
                {loading ? (
                    <div className={styles.loadingState}>
                        <div className={styles.spinner}></div>
                        <p>Loading users...</p>
                    </div>
                ) : filteredUsers.length > 0 ? (
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>User ID</th>
                                <th>Mobile</th>
                                <th>Email</th>
                                {canManageAdmins && filter === 'admin' && <th>Actions</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {filteredUsers.map((user) => (
                                <tr key={user._id} className={styles.tableRow}>
                                    <td>
                                        <div className={styles.userInfo}>
                                            <div className={styles.avatar}>
                                                {user.firstname?.charAt(0).toUpperCase()}
                                            </div>
                                            <span className={styles.userName}>{user.firstname}</span>
                                        </div>
                                    </td>
                                    <td>
                                        <code className={styles.userId}>{user._id}</code>
                                    </td>
                                    <td>{user.mobile}</td>
                                    <td>{user.email}</td>
                                    {canManageAdmins && filter === 'admin' && (
                                        <td>
                                            <div className={styles.actionButtons}>
                                                <button 
                                                    className={styles.editButton}
                                                    onClick={() => openPopup(user, true)}
                                                >
                                                    <Edit size={14} />
                                                </button>
                                                <button 
                                                    className={styles.deleteButton}
                                                    onClick={() => openPopup(user, false)}
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <div className={styles.emptyState}>
                        <Users size={48} />
                        <h3>No users found</h3>
                        <p>{searchTerm ? 'Try adjusting your search terms' : 'No users match the current filters'}</p>
                    </div>
                )}
            </div>

            {/* Popup Modal */}
            {popupVisible && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modal}>
                        <div className={styles.modalHeader}>
                            <h3>
                                {isCreating ? 'Create New User' : 
                                 isEditing ? 'Edit User' : 'Delete User'}
                            </h3>
                            <button onClick={closePopup} className={styles.closeButton}>
                                <X size={20} />
                            </button>
                        </div>

                        <div className={styles.modalContent}>
                            {(isCreating || isEditing) ? (
                                <div className={styles.form}>
                                    <div className={styles.formGroup}>
                                        <label>First Name</label>
                                        <input
                                            type="text"
                                            placeholder="Enter first name"
                                            value={selectedUser.firstname || ''}
                                            onChange={(e) => setSelectedUser({ ...selectedUser, firstname: e.target.value })}
                                            className={styles.input}
                                        />
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label>Email</label>
                                        <input
                                            type="email"
                                            placeholder="Enter email address"
                                            value={selectedUser.email || ''}
                                            onChange={(e) => setSelectedUser({ ...selectedUser, email: e.target.value })}
                                            className={styles.input}
                                        />
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label>Mobile</label>
                                        <input
                                            type="text"
                                            placeholder="Enter mobile number"
                                            value={selectedUser.mobile || ''}
                                            onChange={(e) => setSelectedUser({ ...selectedUser, mobile: e.target.value })}
                                            className={styles.input}
                                        />
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label>Password</label>
                                        <input
                                            type="password"
                                            placeholder="Enter password"
                                            value={selectedUser.password || ''}
                                            onChange={(e) => setSelectedUser({ ...selectedUser, password: e.target.value })}
                                            className={styles.input}
                                        />
                                    </div>
                                </div>
                            ) : (
                                <div className={styles.userDetails}>
                                    <p><strong>Name:</strong> {selectedUser.firstname}</p>
                                    <p><strong>Email:</strong> {selectedUser.email}</p>
                                    <p><strong>Mobile:</strong> {selectedUser.mobile}</p>
                                    <div className={styles.warning}>
                                        <p>This action cannot be undone. Are you sure you want to delete this user?</p>
                                    </div>
                                </div>
                            )}

                        </div>

                        <div className={styles.modalActions}>
                            <button onClick={closePopup} className={styles.cancelButton}>
                                Cancel
                            </button>
                            {isCreating ? (
                                <button 
                                    onClick={handleCreate} 
                                    className={styles.confirmButton}
                                >
                                    Create User
                                </button>
                            ) : isEditing ? (
                                <button 
                                    onClick={handleEdit} 
                                    className={styles.confirmButton}
                                >
                                    Update User
                                </button>
                            ) : (
                                <button 
                                    onClick={() => handleDelete(selectedUser._id)} 
                                    disabled={!verified}
                                    className={styles.deleteConfirmButton}
                                >
                                    Delete User
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}


export default UsersPage;
