# Development Workflow

## 🔄 Quick Development Commands

### For Code Updates (Use This!)
```bash
# After making changes to src/ files:
./dev-sync.sh
```

### Manual Steps (if needed)
```bash
# 1. Kill existing server
pkill -f "next"

# 2. Rebuild application
npm run build

# 3. Start server
npm start > app.log 2>&1 &
```

## 📝 Git Workflow

### Making Changes
```bash
# 1. Make your changes to src/ files
# 2. Test with dev-sync.sh
# 3. Commit changes
git add .
git commit -m "Description of changes"
git push origin main
```

### Rolling Back Changes
```bash
# See recent commits
git log --oneline -10

# Rollback to previous commit
git reset --hard HEAD~1
./dev-sync.sh

# Rollback to specific commit
git reset --hard <commit-hash>
./dev-sync.sh
```

### Emergency Rollback
```bash
# If something breaks, quickly rollback
git stash
git pull origin main
./dev-sync.sh
```

## 🚨 Important Notes

1. **Always use `./dev-sync.sh`** after making changes to `src/` files
2. **The server runs compiled code** from `.next/server/`, not source files
3. **Changes to `src/` don't affect running server** until rebuild
4. **Git tracks your source code** - use it for version control and rollbacks

## 🔍 Troubleshooting

### Server Not Updating?
```bash
# Check if server is running
ps aux | grep next

# Force restart
pkill -f "next" && ./dev-sync.sh
```

### Build Errors?
```bash
# Check build output
npm run build

# Check server logs
tail -f app.log
```

### Database Issues?
```bash
# Check database
node -e "const db = require('better-sqlite3')('./kinetic.db'); console.log('Orders:', db.prepare('SELECT COUNT(*) FROM shopify_orders').get()); db.close();"
```
