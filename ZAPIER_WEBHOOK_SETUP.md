# QuickBooks Integration via Zapier Webhook

## 🎯 Simple & Clean Approach

Instead of dealing with QuickBooks OAuth complexity, we use Zapier as an intermediary to send new invoices to our webhook endpoint.

## 📡 Webhook Endpoint

**Production URL**: `https://your-app.com/api/webhooks/quickbooks`

**Local Development URL**: `http://localhost:3000/api/webhooks/quickbooks`

**Method**: `POST`

**Content-Type**: `application/json`

## 🏠 Local Development Setup

For local testing, you'll need to expose your localhost to the internet so Zapier can reach it:

### Option 1: Using ngrok (Recommended)
```bash
# Install ngrok
npm install -g ngrok

# Expose localhost:3000
ngrok http 3000

# Use the ngrok URL in Zapier (e.g., https://abc123.ngrok.io/api/webhooks/quickbooks)
```

### Option 2: Using other tunneling services
- **localtunnel**: `npx localtunnel --port 3000`
- **serveo**: `ssh -R 80:localhost:3000 serveo.net`
- **cloudflared**: `cloudflared tunnel --url http://localhost:3000`

## 📋 Expected Payload Format

```json
{
  "id": "123",
  "docNumber": "INV-001",
  "customerName": "John Doe",
  "customerEmail": "john@example.com",
  "totalAmount": 150.00,
  "currency": "USD",
  "dueDate": "2024-01-15",
  "billingAddress": "123 Main St, City, State 12345",
  "shippingAddress": "123 Main St, City, State 12345",
  "lineItems": [
    {
      "id": "item1",
      "name": "Product Name",
      "quantity": 2,
      "price": 75.00,
      "total": 150.00,
      "description": "Product description"
    }
  ],
  "notes": "Invoice notes",
  "createdAt": "2024-01-01T00:00:00Z"
}
```

## 🔧 Zapier Configuration

### Step 1: Create Zapier Webhook
1. Go to Zapier and create a new Zap
2. Choose "Webhooks by Zapier" as the trigger
3. Select "Catch Hook" trigger
4. Copy the webhook URL from your admin panel

### Step 2: Configure QuickBooks Trigger
1. Add QuickBooks as the trigger app
2. Choose "New Invoice" event
3. Connect your QuickBooks account
4. Test the connection

### Step 3: Map the Data
Map QuickBooks invoice fields to our webhook payload:

| QuickBooks Field | Webhook Field | Required |
|------------------|---------------|----------|
| Invoice ID | `id` | ✅ |
| Document Number | `docNumber` | ✅ |
| Customer Name | `customerName` | ❌ |
| Customer Email | `customerEmail` | ❌ |
| Total Amount | `totalAmount` | ❌ |
| Currency | `currency` | ❌ |
| Due Date | `dueDate` | ❌ |
| Billing Address | `billingAddress` | ❌ |
| Shipping Address | `shippingAddress` | ❌ |
| Line Items | `lineItems` | ❌ |
| Notes | `notes` | ❌ |
| Created Date | `createdAt` | ❌ |

### Step 4: Test & Activate
1. Test the Zap with a sample invoice
2. Check your admin panel to see the data
3. Activate the Zap

## ✅ What Happens

When a new invoice is created in QuickBooks:

1. **Zapier detects** the new invoice
2. **Zapier sends** the invoice data to our webhook
3. **Our system** automatically:
   - Creates the invoice in `quickbooks_orders` table
   - Creates the customer in `quickbooks_customers` table
   - Creates line items in `orderLineItems` table
4. **Data is ready** for your unified tables

## 🚀 Benefits

- **No OAuth complexity** - Zapier handles QuickBooks authentication
- **Real-time updates** - New invoices appear immediately
- **Simple setup** - Just configure Zapier once
- **Reliable** - Zapier handles retries and error handling
- **Clean code** - No complex QuickBooks API integration

## 🔍 Testing

You can test the webhook endpoint by visiting:
`https://your-app.com/api/webhooks/quickbooks`

This will return a health check response.

## 📊 Data Flow

```
QuickBooks → Zapier → Your Webhook → Database → Unified Tables
```

Simple, clean, and reliable! 🎯
