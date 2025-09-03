# Multi-Source Order Management Architecture

## Overview

This application now supports multiple order and customer data sources (Shopify and QuickBooks) with a unified data layer for clean, deduplicated business operations.

## Database Architecture

### Source Tables (Raw Data)
- **`shopify_customers`** - Raw customer data from Shopify
- **`shopify_orders`** - Raw order data from Shopify  
- **`quickbooks_customers`** - Raw customer data from QuickBooks
- **`quickbooks_orders`** - Raw order/invoice data from QuickBooks

### Unified Tables (Clean Data)
- **`customers`** - Clean, deduplicated customer data from all sources
- **`orders`** - Clean, deduplicated order data from all sources
- **`orderLineItems`** - Line items for all orders
- **`products`** - Product catalog (primarily from Shopify)

## Key Features

### Data Synchronization
- Automatic migration of existing data to new structure
- Sync functions to move data from source tables to unified tables
- Support for incremental updates

### API Endpoints

#### Source-Specific Sync
- `POST /api/shopify/sync-orders` - Sync Shopify orders and customers
- `POST /api/quickbooks/sync-customers` - Sync QuickBooks customers
- `POST /api/quickbooks/sync-orders` - Sync QuickBooks invoices as orders

#### Unified Data Management
- `POST /api/sync/unified` - Sync all source data to unified tables
- `GET /api/sync/unified` - Get sync status and counts
- `GET /api/customers?source=shopify` - Filter customers by source
- `GET /api/orders?source=quickbooks` - Filter orders by source

### Data Flow

1. **Ingestion**: Data comes in through source-specific APIs
2. **Storage**: Raw data stored in source tables (shopify_*, quickbooks_*)
3. **Synchronization**: Data synced to unified tables with cleaning/deduplication
4. **Business Logic**: Applications use unified tables for operations

## Usage Examples

### Sync QuickBooks Data
```javascript
// Sync QuickBooks customers
await fetch('/api/quickbooks/sync-customers', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    customers: quickbooksCustomers,
    accessToken: 'your_token',
    companyId: 'your_company_id'
  })
});

// Sync QuickBooks invoices as orders
await fetch('/api/quickbooks/sync-orders', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    invoices: quickbooksInvoices,
    accessToken: 'your_token',
    companyId: 'your_company_id'
  })
});
```

### Sync All Data to Unified Tables
```javascript
await fetch('/api/sync/unified', { method: 'POST' });
```

### Query Unified Data
```javascript
// Get all customers
const customers = await fetch('/api/customers').then(r => r.json());

// Get only Shopify customers
const shopifyCustomers = await fetch('/api/customers?source=shopify').then(r => r.json());

// Get orders by status
const pendingOrders = await fetch('/api/orders?status=pending').then(r => r.json());
```

## Benefits

1. **Data Integrity**: Raw data preserved for auditing
2. **Flexibility**: Easy to add new data sources
3. **Performance**: Optimized queries on clean, indexed data
4. **Scalability**: Source tables can be archived/partitioned independently
5. **Business Logic**: Clean separation between data ingestion and business operations

## Migration Notes

- Existing data automatically migrated to `shopify_*` tables
- New unified tables created with enhanced schema
- All existing API endpoints updated to work with new structure
- Backward compatibility maintained where possible
