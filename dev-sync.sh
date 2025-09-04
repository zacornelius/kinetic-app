#!/bin/bash

# Development sync script - rebuilds and restarts server
echo "🔄 Rebuilding and restarting server..."

# Kill existing processes
pkill -f "next" 2>/dev/null

# Wait for processes to stop
sleep 2

# Rebuild the application
echo "📦 Building application..."
npm run build

if [ $? -eq 0 ]; then
    echo "✅ Build successful!"
    
    # Start the server
    echo "🚀 Starting server..."
    npm start > app.log 2>&1 &
    
    # Wait a moment for server to start
    sleep 3
    
    # Check if server is running
    if pgrep -f "next-server" > /dev/null; then
        echo "✅ Server started successfully!"
        echo "🌐 App available at: http://3.145.159.251:3000"
        echo "📊 Admin panel: http://3.145.159.251:3000/admin"
    else
        echo "❌ Server failed to start. Check app.log for errors."
    fi
else
    echo "❌ Build failed. Check the errors above."
fi
