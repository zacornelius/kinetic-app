# Development Workflow

## 🚀 FAST Development (Hot Reloading)

### For Real-Time Development (RECOMMENDED!)
```bash
# Start development server with hot reloading
npm run dev

# Changes to src/ files are reflected IMMEDIATELY!
# No rebuild needed, no restart needed!
```

### For Production Deployment
```bash
# Only when ready to deploy
npm run build
npm start
```

## 📝 Git Workflow

### Making Changes
```bash
# 1. Start dev server: npm run dev
# 2. Make changes to src/ files (changes appear instantly!)
# 3. Test your changes in browser
# 4. Commit when ready
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
# Changes will appear instantly in dev mode!

# Rollback to specific commit
git reset --hard <commit-hash>
# Changes will appear instantly in dev mode!
```

### Emergency Rollback
```bash
# If something breaks, quickly rollback
git stash
git pull origin main
# Changes will appear instantly in dev mode!
```

## 🚨 Important Notes

1. **Use `npm run dev` for development** - changes appear instantly!
2. **Use `npm run build && npm start` for production** - optimized build
3. **Git tracks your source code** - use it for version control and rollbacks
4. **Development server runs from source files** - no rebuild needed!

## 🔍 Troubleshooting

### Server Not Updating?
```bash
# Check if dev server is running
ps aux | grep "next dev"

# Restart dev server
pkill -f "next dev" && npm run dev
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
