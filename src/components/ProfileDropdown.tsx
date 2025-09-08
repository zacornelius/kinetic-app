'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

interface ProfileDropdownProps {
  className?: string;
}

export default function ProfileDropdown({ className = '' }: ProfileDropdownProps) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Get user initials
  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Check notification permission status
  useEffect(() => {
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  const handleSignOut = async () => {
    await logout();
    router.push('/login');
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      return;
    }

    setIsChangingPassword(true);
    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ newPassword }),
      });

      if (response.ok) {
        setShowPasswordModal(false);
        setNewPassword('');
        setConfirmPassword('');
        alert('Password changed successfully');
      } else {
        const error = await response.json();
        setPasswordError(error.message || 'Failed to change password');
      }
    } catch (error) {
      setPasswordError('Failed to change password');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleNotificationSettings = () => {
    setShowNotificationModal(true);
  };

  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
      alert('This browser does not support notifications');
      return;
    }

    if (!('serviceWorker' in navigator)) {
      alert('Service Worker not supported in this browser');
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      
      if (permission === 'granted') {
        // Register service worker if not already registered
        const registration = await navigator.serviceWorker.register('/sw.js?v=' + Date.now());
        await navigator.serviceWorker.ready;
        
        // Force update the service worker
        if (registration.waiting) {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
        if (registration.installing) {
          registration.installing.addEventListener('statechange', (e) => {
            if (e.target.state === 'installed' && navigator.serviceWorker.controller) {
              window.location.reload();
            }
          });
        }
        
        // Subscribe to push notifications
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: 'BFaG3z0R7CrT_J6CIB3G3YdumRrQUBXdsGnsEEZQL7cygZqtefy_ausFswT428tkHuY81pSCs2nj3jXB-255buk'
        });

        // Send subscription to server
        const response = await fetch('/api/notifications/subscribe', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(subscription),
        });
        
        if (response.ok) {
          setNotificationPermission('granted');
          alert('Notifications enabled successfully! You will now receive notifications when new inquiries arrive.');
        } else {
          const error = await response.json();
          alert(`Failed to enable notifications: ${error.error}`);
        }
      } else if (permission === 'denied') {
        alert('Notifications are blocked. Please enable them in your browser settings.');
      } else {
        alert('Notification permission was not granted.');
      }
    } catch (error) {
      console.error('Error setting up notifications:', error);
      alert(`Error setting up notifications: ${error.message}`);
    }
  };

  if (!user) return null;

  return (
    <>
      <div className={`relative ${className}`} ref={dropdownRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center justify-center w-8 h-8 bg-gray-600 text-white rounded-full hover:bg-gray-700 transition-colors"
        >
          <span className="text-xs font-medium">
            {getInitials(user.firstName, user.lastName)}
          </span>
        </button>

        {isOpen && (
          <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
            <div className="px-4 py-3 border-b border-gray-200 bg-black rounded-t-lg">
              <p className="text-sm font-medium text-white">
                {user.firstName} {user.lastName}
              </p>
              <p className="text-sm text-gray-300">{user.email}</p>
              {user.role === 'admin' && (
                <span className="inline-block mt-1 px-2 py-1 text-xs font-medium bg-[#C43C37] text-white rounded-full">
                  Admin
                </span>
              )}
            </div>

            <div className="py-2">
              {user.role === 'admin' && (
                <button
                  onClick={() => {
                    setIsOpen(false);
                    router.push('/admin');
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                >
                  <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Admin Dashboard
                </button>
              )}

              <button
                onClick={() => {
                  setIsOpen(false);
                  setShowPasswordModal(true);
                }}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center"
              >
                <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
                Change Password
              </button>

              <button
                onClick={() => {
                  setIsOpen(false);
                  handleNotificationSettings();
                }}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center"
              >
                <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5v-5zM4.5 19.5a3 3 0 01-3-3V6a3 3 0 013-3h9a3 3 0 013 3v10.5a3 3 0 01-3 3h-9z" />
                </svg>
                Notification Settings
              </button>

              <div className="border-t border-gray-200 mt-2 pt-2">
                <button
                  onClick={handleSignOut}
                  className="w-full px-4 py-2 text-left text-sm text-[#C43C37] hover:bg-gray-100 flex items-center"
                >
                  <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Password Change Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4">Change Password</h3>
            <form onSubmit={handlePasswordChange}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  New Password
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Confirm Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              {passwordError && (
                <div className="mb-4 text-red-600 text-sm">{passwordError}</div>
              )}
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordModal(false);
                    setNewPassword('');
                    setConfirmPassword('');
                    setPasswordError('');
                  }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isChangingPassword}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {isChangingPassword ? 'Changing...' : 'Change Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Notification Settings Modal */}
      {showNotificationModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4">Notification Settings</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Push Notifications</p>
                  <p className="text-sm text-gray-500">
                    Status: <span className={`font-medium ${
                      notificationPermission === 'granted' ? 'text-green-600' : 
                      notificationPermission === 'denied' ? 'text-red-600' : 
                      'text-yellow-600'
                    }`}>
                      {notificationPermission === 'granted' ? 'Enabled' : 
                       notificationPermission === 'denied' ? 'Blocked' : 
                       'Not Set'}
                    </span>
                  </p>
                </div>
                <button
                  onClick={requestNotificationPermission}
                  disabled={notificationPermission === 'granted'}
                  className={`px-4 py-2 text-white rounded-md hover:opacity-90 disabled:opacity-50 ${
                    notificationPermission === 'granted' 
                      ? 'bg-green-600' 
                      : notificationPermission === 'denied'
                      ? 'bg-red-600'
                      : 'bg-blue-600'
                  }`}
                >
                  {notificationPermission === 'granted' ? 'Enabled' : 
                   notificationPermission === 'denied' ? 'Unblock in Settings' : 
                   'Enable'}
                </button>
              </div>
              <div className="text-sm text-gray-500">
                <p>• Get notified about new inquiries</p>
                <p>• Receive updates about your assigned tasks</p>
                <p>• Stay informed about system changes</p>
              </div>
              {notificationPermission === 'denied' && (
                <div className="bg-red-50 border border-red-200 rounded-md p-3">
                  <p className="text-sm text-red-700">
                    Notifications are blocked. Please enable them in your browser settings to receive updates.
                  </p>
                </div>
              )}
            </div>
            <div className="flex justify-end mt-6">
              <button
                onClick={() => setShowNotificationModal(false)}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
