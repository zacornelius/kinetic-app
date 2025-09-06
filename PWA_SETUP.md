# PWA Setup Guide

Your Kinetic App is now configured as a Progressive Web App (PWA) with push notification support!

## Features Enabled

✅ **App Installation** - Users can "Add to Home Screen"  
✅ **Offline Support** - Works without internet connection  
✅ **Push Notifications** - Real-time alerts and updates  
✅ **App Shortcuts** - Quick access to Data Explorer and Admin  
✅ **Responsive Design** - Optimized for mobile and desktop  

## Setup Required

### 1. Generate VAPID Keys for Push Notifications

```bash
# Install web-push globally (if not already installed)
npm install -g web-push

# Generate VAPID keys
web-push generate-vapid-keys
```

This will output something like:
```
=======================================

Public Key:
BEl62iUYgUivxIkv69yViEuiBIa40HI8F2j6QoF1yY...

Private Key:
gWHEizKEXs6bk4iZ7GXa-9bF1yY...

=======================================
```

### 2. Add Environment Variables

Create a `.env.local` file in your project root:

```env
# VAPID Keys for Push Notifications
VAPID_PUBLIC_KEY=your_public_key_here
VAPID_PRIVATE_KEY=your_private_key_here

# Webhook Authentication (already configured)
WEBHOOK_USERNAME=kinetic
WEBHOOK_PASSWORD=webhook2024
```

### 3. Update Notification API

Update the email in the notification API files:
- `src/app/api/notifications/subscribe/route.ts`
- `src/app/api/notifications/test/route.ts`

Change `your-email@example.com` to your actual email address.

## How It Works

### Installation
- Users will see an "Install App" button when the app is ready
- On mobile: Tap the button or use browser's "Add to Home Screen"
- On desktop: Install button appears in browser address bar

### Offline Support
- Service worker caches static files automatically
- App works without internet connection
- Data syncs when connection is restored

### Push Notifications
- Users can enable/disable notifications
- Test notifications available for verification
- Real-time alerts for important updates

### App Shortcuts
- Data Explorer: Quick access to analytics
- Admin Dashboard: Direct admin access
- Available in app menu and home screen

## Testing

1. **Install the App**:
   - Open the app in Chrome/Edge
   - Look for install button or "Add to Home Screen"
   - Install and test offline functionality

2. **Test Notifications**:
   - Click "Enable Notifications" button
   - Click "Test Notification" to verify
   - Check browser notification settings

3. **Test Offline**:
   - Install the app
   - Turn off internet connection
   - App should still work with cached content

## Customization

### Icons
- Replace SVG files in `public/icons/` with your custom icons
- Convert to PNG for better compatibility if needed
- Update manifest.json if changing icon sizes

### App Metadata
- Edit `public/manifest.json` for app name, description, colors
- Update `src/app/layout.tsx` for meta tags and titles

### Notification Content
- Modify notification templates in `src/app/api/notifications/`
- Add custom notification triggers in your app logic

## Browser Support

- **Chrome/Edge**: Full PWA support
- **Firefox**: Basic PWA support
- **Safari**: Limited PWA support (iOS 11.3+)
- **Mobile**: Excellent support on Android/iOS

## Security Notes

- HTTPS required for PWA features
- VAPID keys must be kept secure
- Service worker runs in background
- Push notifications require user permission

Your app is now a fully functional PWA! 🎉
