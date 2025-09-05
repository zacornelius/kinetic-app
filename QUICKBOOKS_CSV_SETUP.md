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

### 3. Payload Format
```json
{
  "csvData": [
    {
      "Transaction_ID": "QB-001",
      "Customer_Name": "John Doe",
      "Customer_Email": "john@example.com",
      "Total": "1500.00",
      "Transaction_Date": "2024-01-15",
      "Billing_Address": "123 Main St, City, State, 12345",
      "Shipping_Address": "123 Main St, City, State, 12345",
      "Due_Date": "2024-02-15",
      "Memo": "Invoice notes",
      "Line_Items": "[{\"name\":\"Product 1\",\"quantity\":2,\"price\":750}]"
    }
  ],
  "reportDate": "2024-01-16",
  "totalRows": 1
}
```

## CSV Column Mapping

The webhook maps these CSV columns to our database format:

| **CSV Column** | **Database Field** | **Description** |
|----------------|-------------------|-----------------|
| `Transaction_ID` | `orderNumber` | Unique transaction identifier |
| `Customer_Name` | `customerName` | Customer full name |
| `Customer_Email` | `customerEmail` | Customer email address |
| `Total` | `totalAmount` | Transaction total amount |
| `Transaction_Date` | `createdAt` | Transaction date |
| `Billing_Address` | `billingAddress` | Customer billing address |
| `Shipping_Address` | `shippingAddress` | Customer shipping address |
| `Due_Date` | `dueDate` | Payment due date |
| `Memo` | `notes` | Transaction notes |
| `Line_Items` | `lineItems` | JSON string of line items |

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
