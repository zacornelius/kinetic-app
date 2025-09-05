# QuickBooks CSV Webhook Setup

## Overview
This webhook receives daily CSV reports from QuickBooks via Zapier and processes them with deduplication logic to maintain data consistency.

## Webhook Details

**URL:** `http://3.145.159.251:3000/api/webhooks/quickbooks-csv`

**Authentication:** Basic Auth
- **Username:** `kinetic`
- **Password:** `webhook2024`

**Method:** POST

## Zapier Configuration

### 1. Email Service Setup
- Set up Zapier to receive daily CSV reports from QuickBooks
- Parse the CSV data into JSON format
- Send to webhook endpoint

### 2. Webhook Configuration
- **URL:** `http://3.145.159.251:3000/api/webhooks/quickbooks-csv`
- **Authentication:** Basic Auth
- **Username:** `kinetic`
- **Password:** `webhook2024`
- **Method:** POST
- **Content Type:** application/json

### 3. Payload Format (Raw CSV Format)
```json
{
  "Zac customer contact list": "Customer full name,Email,Full name,Bill address,Ship address,Phone\nCity of Miami-Finance Gen Accounting,29234@miami-police.org,Miami Police Department,123 Police Plaza Miami FL 33101,123 Police Plaza Miami FL 33101,305-123-4567",
  "zac line items": "Product/Service,Transaction date,Transaction type,Num,Customer full name,Memo/Description,Quantity,Sales price,Amount\nPallet 15-24K,01/31/2025,Invoice,509,7th Special Forces Group K9 Unit,Vital 24K Kinetic Dog Food 35 lb,45.00,58.64,2638.80",
  "reportDate": "2025-01-31",
  "totalRows": 1
}
```

## CSV Column Mapping (Simplified 2-File Structure)

The webhook maps these CSV columns to our database format:

### Customer Data (Kinetic Nutrition Group LLC_Zac Customer Contact List.csv)
| **CSV Column** | **Database Field** | **Description** |
|----------------|-------------------|-----------------|
| `Customer full name` | `customerName` | Customer full name |
| `Email` | `customerEmail` | Customer email |
| `Full name` | `firstName/lastName` | Parsed contact person name |
| `Bill address` | `billingAddress` | Billing address |
| `Ship address` | `shippingAddress` | Shipping address |
| `Phone` | `phone` | Customer phone |

### Line Items Data (Kinetic Nutrition Group LLC_Zac Line items.csv)
| **CSV Column** | **Database Field** | **Description** |
|----------------|-------------------|-----------------|
| `Num` | `orderNumber` | Invoice number |
| `Customer full name` | `customerName` | Links to customer |
| `Product/Service` | `product` | Product name |
| `Quantity` | `quantity` | Item quantity |
| `Sales price` | `price` | Unit price |
| `Amount` | `amount` | Line total |
| `Transaction date` | `createdAt` | Order date |
| `Memo/Description` | `description` | Item description |

## Features

### ✅ Simplified Processing
- **2-File Format:** Only customer data and line items needed
- **Pre-filtered Data:** Only relevant transactions included
- **Streamlined Mapping:** Direct column mapping without complex merging

### ✅ Deduplication
- **New Orders:** Inserted if invoice number doesn't exist
- **Existing Orders:** Updated with latest data
- **Customers:** Updated if email exists, created if new

### ✅ Data Consistency
- **Format:** Matches Shopify data structure
- **Unified Tables:** Auto-syncs to `all_orders` and `all_customers`
- **Data Explorer:** Appears in data explorer with source filtering

### ✅ Error Handling
- **Row-level errors:** Continue processing other rows
- **Authentication:** Basic Auth protection
- **Validation:** Required field validation
- **Logging:** Detailed processing logs

## Response Format

```json
{
  "success": true,
  "message": "Successfully processed 5 orders and 3 customers from QuickBooks CSV data",
  "stats": {
    "ordersProcessed": 5,
    "customersProcessed": 3,
    "totalLineItems": 5,
    "totalCustomers": 3
  }
}
```

## Testing

### Test the webhook:
```bash
curl -X POST http://3.145.159.251:3000/api/webhooks/quickbooks-csv \
  -H "Content-Type: application/json" \
  -u "kinetic:webhook2024" \
  -d '{
    "Zac customer contact list": "Customer full name,Email,Full name,Bill address,Ship address,Phone\nTest Customer,test@example.com,Test User,123 Test St,123 Test St,555-1234",
    "zac line items": "Product/Service,Transaction date,Transaction type,Num,Customer full name,Memo/Description,Quantity,Sales price,Amount\nTest Product,01/31/2025,Invoice,TEST-001,Test Customer,Test order,1.00,100.00,100.00"
  }'
```

### Check health:
```bash
curl -u "kinetic:webhook2024" http://3.145.159.251:3000/api/webhooks/quickbooks-csv
```

## Data Explorer

After processing, QuickBooks data will appear in:
- **Orders Tab:** Filter by "QuickBooks" source
- **Customers Tab:** QuickBooks customers
- **Line Items Tab:** Product line items from transactions

## Next Steps

1. **Configure Zapier** with the simplified 2-file format
2. **Test with real data** from QuickBooks
3. **Adjust column mapping** if needed
4. **Set up daily automation** in Zapier
5. **Monitor data quality** in data explorer

## Troubleshooting

- **Check logs:** `tail -f dev.log | grep quickbooks`
- **Verify authentication:** Test with curl command above
- **Check data format:** Ensure CSV columns match expected names
- **Database issues:** Check if `quickbooks_orders` table exists