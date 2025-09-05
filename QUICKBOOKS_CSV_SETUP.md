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

### 3. Payload Format (Three-File Structure)
```json
{
  "reportData": [
    {
      "Date": "01/15/2024",
      "Transaction type": "Invoice",
      "Num": "426",
      "Name": "City of Miami-Finance Gen Accounting",
      "Department full name": "",
      "Memo/Description": "",
      "Due date": "11/16/2024",
      "Amount": "2,914.15",
      "Open balance": "0.00",
      "Delivery address": "29234@miami-police.org"
    }
  ],
  "customerData": [
    {
      "Customer full name": "City of Miami-Finance Gen Accounting",
      "Phone numbers": "305-123-4567",
      "Email": "29234@miami-police.org",
      "Full name": "Miami Police Department",
      "Bill address": "123 Police Plaza, Miami, FL 33101",
      "Ship address": "123 Police Plaza, Miami, FL 33101"
    }
  ],
  "lineItemsData": [
    {
      "Product/Service": "Active 26K Pallet",
      "Transaction date": "01/15/2024",
      "Transaction type": "Invoice",
      "Num": "426",
      "Customer full name": "City of Miami-Finance Gen Accounting",
      "Memo/Description": "Police K9 food order",
      "Quantity": "1.00",
      "Sales price": "2914.15",
      "Amount": "2914.15",
      "Balance": "2914.15"
    }
  ],
  "reportDate": "2024-01-15",
  "totalRows": 1
}
```

## CSV Column Mapping (Three-File Structure)

The webhook maps these CSV columns to our database format:

### Report Data (Zac Report.csv)
| **CSV Column** | **Database Field** | **Description** |
|----------------|-------------------|-----------------|
| `Num` | `orderNumber` | Invoice number |
| `Name` | `customerName` | Customer name |
| `Date` | `createdAt` | Transaction date |
| `Amount` | `totalAmount` | Transaction total |
| `Due date` | `dueDate` | Payment due date |
| `Memo/Description` | `notes` | Transaction notes |
| `Delivery address` | `shippingAddress` | Delivery address |

### Customer Data (Zac Customer Contact List.csv)
| **CSV Column** | **Database Field** | **Description** |
|----------------|-------------------|-----------------|
| `Customer full name` | `customerName` | Customer full name |
| `Email` | `customerEmail` | Customer email |
| `Phone numbers` | `phone` | Customer phone |
| `Full name` | `firstName/lastName` | Parsed name |
| `Bill address` | `billingAddress` | Billing address |
| `Ship address` | `shippingAddress` | Shipping address |

### Line Items Data (Zac Line items.csv)
| **CSV Column** | **Database Field** | **Description** |
|----------------|-------------------|-----------------|
| `Num` | `orderNumber` | Links to invoice |
| `Customer full name` | `customerName` | Links to customer |
| `Product/Service` | `product` | Product name |
| `Quantity` | `quantity` | Item quantity |
| `Sales price` | `price` | Unit price |
| `Amount` | `amount` | Line total |
| `Memo/Description` | `description` | Item description |

## Features

### ✅ Deduplication
- **New Orders:** Inserted if `Transaction_ID` doesn't exist
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
  "message": "QuickBooks CSV processed successfully. 2 rows processed.",
  "stats": {
    "totalRows": 2,
    "processedRows": 2,
    "newOrders": 1,
    "updatedOrders": 1,
    "newCustomers": 1,
    "updatedCustomers": 1,
    "unified": {
      "allOrders": 688,
      "shopifyOrders": 683,
      "quickbooksOrders": 5
    }
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
    "csvData": [
      {
        "Transaction_ID": "QB-TEST-001",
        "Customer_Name": "Test Customer",
        "Customer_Email": "test@example.com",
        "Total": "1000.00",
        "Transaction_Date": "2024-01-15"
      }
    ],
    "reportDate": "2024-01-15",
    "totalRows": 1
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
- **Line Items Tab:** If line items are provided in CSV

## Next Steps

1. **Configure Zapier** with your actual CSV column names
2. **Test with real data** from QuickBooks
3. **Adjust column mapping** if needed
4. **Set up daily automation** in Zapier
5. **Monitor data quality** in data explorer

## Troubleshooting

- **Check logs:** `tail -f dev.log | grep quickbooks`
- **Verify authentication:** Test with curl command above
- **Check data format:** Ensure CSV columns match expected names
- **Database issues:** Check if `quickbooks_orders` table exists
