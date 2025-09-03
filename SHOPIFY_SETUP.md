# Shopify Integration Setup

This guide will help you set up the Shopify integration to sync historical orders into your sales dashboard.

## 1. Create a Shopify Private App

1. Go to your Shopify Admin Dashboard
2. Navigate to **Settings** > **Apps and sales channels**
3. Click **Develop apps** (at the bottom)
4. Click **Create an app**
5. Give your app a name (e.g., "Sales Dashboard Integration")
6. Click **Create app**

## 2. Configure App Permissions

1. In your app settings, click **Configuration**
2. Under **Admin API access scopes**, enable these permissions:
   - `read_orders` - To fetch order data
   - `read_customers` - To get customer information
3. Click **Save**

## 3. Install and Get Credentials

1. Click **Install app**
2. After installation, go to **API credentials** tab
3. Copy the **Admin API access token**
4. Note your shop name (the part before `.myshopify.com`)

## 4. Set Environment Variables

Create a `.env.local` file in your project root with:

```env
# Shopify Configuration
NEXT_PUBLIC_SHOPIFY_SHOP=your-shop-name
NEXT_PUBLIC_SHOPIFY_ACCESS_TOKEN=your-access-token
SHOPIFY_SYNC_LIMIT=250
```

Replace:
- `your-shop-name` with your actual shop name (without .myshopify.com)
- `your-access-token` with the Admin API access token from step 3

## 5. Sync Orders

1. Go to your admin dashboard (`/admin`)
2. Click the **"Sync Shopify Orders"** button
3. The system will fetch all historical orders from your Shopify store
4. Orders will be imported into your local database

## 6. Order Status Mapping

The system automatically maps Shopify order statuses to your internal statuses:

- **Pending** → `pending` (new orders)
- **Paid** → `processing` (payment received)
- **Partially Fulfilled** → `shipped` (some items shipped)
- **Fulfilled** → `delivered` (order complete)

## 7. Data Included

For each order, the system imports:
- Order number and date
- Customer email and name
- Total amount and currency
- Order status
- Shipping address
- Order notes
- Line items (for reference)

## Troubleshooting

### Common Issues:

1. **"Shopify API error: 401"**
   - Check your access token is correct
   - Ensure the app is properly installed

2. **"Shopify API error: 403"**
   - Verify you have the correct permissions enabled
   - Make sure `read_orders` scope is enabled

3. **"Shop not found"**
   - Check your shop name (should be just the name, not the full URL)
   - Ensure there are no typos

### Rate Limits:

Shopify has API rate limits. The sync process handles pagination automatically, but for very large stores (1000+ orders), the sync might take a few minutes.

## Security Notes

- Never commit your `.env.local` file to version control
- Keep your access token secure
- Consider using environment-specific tokens for production
- The access token gives read-only access to orders and customers

## Next Steps

After syncing orders, you can:
- View orders in the **Orders** tab of your sales dashboard
- Assign orders to sales team members
- Track order status and fulfillment
- Use the **Customers** tab to see customer order history

