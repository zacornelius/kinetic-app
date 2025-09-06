# Custom Icon Setup Guide

## 🎨 How to Set Custom Icons for Your PWA

### **Method 1: Replace Existing Icons (Easiest)**

1. **Create your custom icon** (recommended size: 512x512px)
2. **Replace the files** in `public/icons/`:
   - `icon-192x192.png` (main icon)
   - `icon-512x512.png` (high-res icon)
   - `icon-72x72.png`, `icon-96x96.png`, etc. (other sizes)

### **Method 2: Use Online Icon Generators**

1. **PWA Builder** (https://www.pwabuilder.com/imageGenerator)
   - Upload your logo
   - Download all required sizes
   - Replace files in `public/icons/`

2. **Favicon.io** (https://favicon.io/)
   - Upload your image
   - Generate PWA icons
   - Download and replace

### **Method 3: Create Icons Manually**

1. **Design your icon** in Figma, Canva, or Photoshop
2. **Export in multiple sizes**:
   - 72x72px
   - 96x96px
   - 128x128px
   - 144x144px
   - 152x152px
   - 192x192px (main)
   - 384x384px
   - 512x512px (high-res)

3. **Save as PNG** for best compatibility

### **Method 4: Use the Custom Icon Generator**

1. **Edit the design** in `generate-custom-icons.js`:
   ```javascript
   function createCustomIcon(size) {
     return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
       <!-- Your custom design here -->
       <rect width="${size}" height="${size}" fill="#your-color" rx="${size * 0.2}"/>
       <text x="50%" y="50%" font-size="${size * 0.6}" fill="white">YOUR LOGO</text>
     </svg>`;
   }
   ```

2. **Run the generator**:
   ```bash
   node generate-custom-icons.js
   ```

3. **Convert to PNG** (optional):
   ```bash
   ./convert-icons-to-png.sh
   ```

## 📱 Icon Requirements

### **Required Sizes:**
- **72x72px** - Small mobile icons
- **96x96px** - Android home screen
- **128x128px** - Windows tiles
- **144x144px** - Windows tiles
- **152x152px** - iOS home screen
- **192x192px** - **Main icon** (most important)
- **384x384px** - Android splash screen
- **512x512px** - **High-res icon** (most important)

### **Design Guidelines:**
- **Square format** (1:1 aspect ratio)
- **Simple design** (works at small sizes)
- **High contrast** (visible on any background)
- **No text** (use symbols/logos instead)
- **Consistent branding** (matches your app theme)

## 🔧 Testing Your Icons

1. **Clear browser cache** (Ctrl+Shift+R)
2. **Open the app** in Chrome/Edge
3. **Check the install prompt** - your icon should appear
4. **Install the app** and check the home screen icon
5. **Test on mobile** for best results

## 🎯 Pro Tips

- **Start with 512x512px** and scale down
- **Use PNG format** for best compatibility
- **Test on actual devices** (not just browser)
- **Keep it simple** - complex designs don't work at small sizes
- **Use your brand colors** for consistency

## 🚀 Quick Start

1. **Upload your logo** to `public/icons/icon-192x192.png`
2. **Copy the file** to all other sizes (or use an online resizer)
3. **Restart the dev server**: `npm run dev`
4. **Test the PWA** installation

Your custom icons will now appear when users install your PWA! 🎉
