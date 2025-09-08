'use client';

import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export default function PWAInstaller() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallButton, setShowInstallButton] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  const [isSafari, setIsSafari] = useState(false);

  useEffect(() => {
    // Check if app is already installed
    const checkInstalled = () => {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      const isInApp = window.navigator.standalone === true; // iOS Safari
      const isInstalledCheck = isStandalone || isInApp;
      
      if (isInstalledCheck) {
        setIsInstalled(true);
        setShowInstallButton(false);
      }
    };
    
    checkInstalled();
    
    // Check again after a delay to ensure proper detection
    const timeoutId = setTimeout(checkInstalled, 500);
    
    return () => clearTimeout(timeoutId);

    // Listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowInstallButton(true);
    };

    // Listen for appinstalled event
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setShowInstallButton(false);
      setDeferredPrompt(null);
      setShowSuccessMessage(true);
      // Hide success message after 5 seconds
      setTimeout(() => setShowSuccessMessage(false), 5000);
    };

    // Check notification permission
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    }

    // Detect Safari
    const isSafariBrowser = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    setIsSafari(isSafariBrowser);

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      // Request notification permission after successful installation
      setTimeout(() => {
        requestNotificationPermission();
      }, 1000);
    } else {
    }
    
    setDeferredPrompt(null);
    setShowInstallButton(false);
  };

  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
      alert('This browser does not support notifications');
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);

      if (permission === 'granted') {
        // Show immediate notification to confirm it works
        new Notification('Kinetic App', {
          body: 'Notifications enabled! You can now receive updates.',
          icon: '/icons/icon-192x192.png'
        });
        
        // Always try to register for push notifications (PWA should support this)
        await registerForPushNotifications();
      } else {
        alert('Notifications were denied. You can enable them in your browser settings.');
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      alert('Error enabling notifications. Please try again.');
    }
  };

  const registerForPushNotifications = async () => {
    
    if (!('serviceWorker' in navigator)) {
      return;
    }

    try {
      const registration = await navigator.serviceWorker.register('/sw.js?v=' + Date.now());
      await navigator.serviceWorker.ready;
      
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
      
      const result = await response.json();

    } catch (error) {
      console.error('Error registering for push notifications:', error);
      alert('Error setting up push notifications: ' + error.message);
    }
  };

  const sendTestNotification = async () => {
    if (notificationPermission !== 'granted') {
      await requestNotificationPermission();
      return;
    }

    try {
      // For Safari, show a direct notification
      if (isSafari) {
        new Notification('Test Notification', {
          body: 'This is a test notification from Kinetic App!',
          icon: '/icons/icon-192x192.png'
        });
      } else {
        // For other browsers, use the API
        await fetch('/api/notifications/test', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: 'Test Notification',
            body: 'This is a test notification from Kinetic App!',
            icon: '/icons/icon-192x192.png'
          }),
        });
      }
    } catch (error) {
      console.error('Error sending test notification:', error);
      alert('Error sending test notification. Please try again.');
    }
  };

  // Only show success message briefly after installation
  if (isInstalled && showSuccessMessage) {
    return (
      <div className="bg-black border border-gray-700 rounded-lg p-4 mb-4">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3 flex-1">
            <p className="text-sm font-medium text-white mb-2">
              App installed successfully! You can now use it offline.
            </p>
            <div className="flex space-x-3">
              <button
                onClick={requestNotificationPermission}
                className="bg-green-600 text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                {notificationPermission === 'granted' ? 'Notifications Enabled' : 'Enable Notifications'}
              </button>
              {notificationPermission === 'granted' && (
                <button
                  onClick={sendTestNotification}
                  className="bg-purple-600 text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  Test Notification
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Only show the installer if the app is not installed AND the install button is available
  if (!isInstalled && showInstallButton) {
    return (
      <div className="bg-black border border-gray-700 rounded-lg p-4 mb-4">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3 flex-1">
            <h3 className="text-sm font-medium text-white">
              Install Team Kinetic
            </h3>
            <div className="mt-2 text-sm text-gray-300">
              <p>Install this app on your device for a better experience with offline access.</p>
            </div>
            <div className="mt-3">
              <button
                onClick={handleInstallClick}
                className="bg-[#3B83BE] text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-[#2D6BA8] focus:outline-none focus:ring-2 focus:ring-[#3B83BE]"
              >
                Install App
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Don't render anything if the app is installed or install button is not available
  return null;
}
