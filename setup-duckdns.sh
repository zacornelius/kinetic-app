#!/bin/bash

echo "🦆 DuckDNS Setup for Kinetic App"
echo "================================="
echo ""
echo "Your EC2 IP: 3.145.159.251"
echo ""

# Check if we can reach DuckDNS
echo "📡 Testing DuckDNS connectivity..."
if curl -s "https://www.duckdns.org" > /dev/null; then
    echo "✅ DuckDNS is reachable"
else
    echo "❌ Cannot reach DuckDNS. Check your internet connection."
    exit 1
fi

echo ""
echo "🔧 Next steps:"
echo "1. Go to https://www.duckdns.org"
echo "2. Sign up for a free account (or sign in if you have one)"
echo "3. Add a domain: 'kinetic-app'"
echo "4. Copy your token"
echo "5. Run this command with your token:"
echo ""
echo "   curl \"https://www.duckdns.org/update?domains=kinetic-app&token=YOUR_TOKEN&ip=3.145.159.251\""
echo ""
echo "6. After DNS propagates (5-10 minutes), run:"
echo "   sudo certbot --nginx -d kinetic-app.duckdns.org"
echo ""
echo "🎯 Your final URL will be: https://kinetic-app.duckdns.org"
echo ""
echo "📱 This will enable PWA installation on iPhone!"
