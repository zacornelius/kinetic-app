# KINETIC APP - Development Workflow

## 🎯 KINETICAPP NEW BASELINE v1.0

This repository is now based on the **KINETICAPP NEW BASELINE v1.0** - a clean, efficient foundation for all future development.

## 📋 Branch Structure

### Active Development
- **`main`** - The ONLY active development branch
  - All new features must be developed from `main`
  - All pull requests must target `main`
  - This is the single source of truth for production

### Reference Branches
- **`KINETICAPP-NEW-BASELINE`** - Foundation baseline (reference only)
- **`feature/master-data-distributor-digital`** - Legacy feature branch (archived)

## 🚀 Development Workflow

### 1. Starting New Work
```bash
# Always start from main
git checkout main
git pull origin main

# Create feature branch from main
git checkout -b feature/your-feature-name
```

### 2. Making Changes
- Work on your feature branch
- Commit frequently with descriptive messages
- Push your branch to origin

### 3. Merging Work
```bash
# Create pull request targeting main branch
# After approval, merge into main
git checkout main
git pull origin main
git branch -d feature/your-feature-name
```

## 🏗️ What's Included in This Baseline

### ✅ Consolidated Customer API System
- Single `/api/customers/consolidated` endpoint
- Replaces 8 separate customer APIs
- Timeline support with sequential interactions
- Line items included in orders
- Customer ID based system

### ✅ Database Optimization
- Pruned 10 redundant tables
- Consolidated to `all_orders` and `customers` tables
- Proper foreign key relationships
- Business unit logic unified

### ✅ Frontend Improvements
- Customer type badges working (`customerType` vs `customertype`)
- Responsive design
- Single API calls for better performance
- Timeline view with sequential data

### ✅ API Isolation
- Customers tab uses only consolidated API
- Orders API only loads on home tab
- Proper error handling and validation

### ✅ Runtime Stability
- Fixed array validation issues
- Proper TypeScript types
- No more `filter()` errors
- Graceful error handling

## 🔧 Key Files

### API Endpoints
- `/api/customers/consolidated` - Main customer API
- `/api/orders` - Orders API (home tab only)
- `/api/inquiries` - Inquiries API
- `/api/quotes` - Quotes API

### Database Tables
- `customers` - Master customer table
- `all_orders` - Consolidated orders table
- `customer_notes` - Customer notes
- `inquiries` - Customer inquiries
- `quotes` - Quote management

## 📝 Commit Guidelines

### Format
```
type(scope): description

[optional body]

[optional footer]
```

### Types
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes
- `refactor`: Code refactoring
- `test`: Test changes
- `chore`: Build/tooling changes

### Examples
```
feat(customers): add timeline view to customer details
fix(api): resolve customer type display issue
docs: update development workflow
```

## 🚨 Important Notes

1. **NEVER develop directly on main** - Always create feature branches
2. **ALWAYS pull latest main** before starting new work
3. **Test thoroughly** before creating pull requests
4. **Use descriptive commit messages** and branch names
5. **Keep feature branches focused** - one feature per branch

## 🔄 Emergency Procedures

### If you accidentally work on main
```bash
# Create a branch from your changes
git checkout -b feature/your-work
git checkout main
git reset --hard origin/main
git checkout feature/your-work
```

### If you need to reset to baseline
```bash
git checkout main
git reset --hard KINETICAPP-NEW-BASELINE-v1.0
git push origin main --force
```

## 📞 Support

For questions about this workflow or the codebase, refer to:
- This documentation
- The baseline tag: `KINETICAPP-NEW-BASELINE-v1.0`
- The consolidated API documentation in `/api/customers/consolidated/route.ts`

---

**Remember: `main` is the single source of truth. All development flows through `main`.**
