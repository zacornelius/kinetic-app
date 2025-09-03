# QuickBooks Integration Setup Guide

## Overview

Your QuickBooks integration is now configured with the following credentials:
- **Client ID**: `ABlSB2Ofm2uxZ6TNPs1jZoDUjoLmV3eU6WQaZsWj2MLoysPfRg`
- **Secret Key**: `J1KqelEuOU9Y9uPaxc3XdLPOf3IltDJDtd4CkNfG`

## Quick Start

1. **Access the QuickBooks Admin Panel**:
   - Navigate to: `http://localhost:3000/admin/quickbooks`
   - This page provides a complete interface for testing the integration

2. **Authentication Flow**:
   - Click "Authenticate with QuickBooks"
   - You'll be redirected to QuickBooks OAuth
   - Authorize the application
   - You'll be redirected back with authentication tokens

3. **Get Your Company ID**:
   - After authentication, you'll need your QuickBooks Company ID
   - This can be found in your QuickBooks URL or API responses
   - Example: `https://app.qbo.intuit.com/app/companyinfo?companyId=123456789`

4. **Test the Connection**:
   - Enter your Company ID in the admin panel
   - Click "Get Company Info" to verify the connection

## API Endpoints

### Authentication
- `GET /api/quickbooks/auth` - Get OAuth authorization URL
- `GET /api/quickbooks/callback` - OAuth callback handler

### Data Operations
- `GET /api/quickbooks/company` - Get company information
- `POST /api/quickbooks/sync-customers` - Sync customers from QuickBooks
- `POST /api/quickbooks/sync-orders` - Sync invoices as orders from QuickBooks
- `POST /api/sync/unified` - Sync all data to unified tables

### Example API Calls

#### Sync Customers from QuickBooks
```javascript
const response = await fetch('/api/quickbooks/sync-customers', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    accessToken: 'your_access_token',
    companyId: 'your_company_id',
    fetchFromQB: true
  })
});
```

#### Sync Orders from QuickBooks
```javascript
const response = await fetch('/api/quickbooks/sync-orders', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    accessToken: 'your_access_token',
    companyId: 'your_company_id',
    fetchFromQB: true
  })
});
```

## Configuration

The integration is configured for **Sandbox mode** by default. To switch to production:

1. Update `QUICKBOOKS_CONFIG.baseUrl` in `/src/lib/quickbooks-config.ts`:
   ```typescript
   baseUrl: 'https://quickbooks.api.intuit.com', // Production
   ```

2. Update the redirect URI in your QuickBooks app settings to match your production domain.

## Data Flow

1. **Authentication**: OAuth flow to get access tokens
2. **Data Fetching**: Pull customers and invoices from QuickBooks
3. **Data Storage**: Store in source tables (`quickbooks_customers`, `quickbooks_orders`)
4. **Data Sync**: Move to unified tables (`customers`, `orders`) for business operations

## Testing

1. **Start your server**: `npm run dev`
2. **Navigate to**: `http://localhost:3000/admin/quickbooks`
3. **Follow the authentication flow**
4. **Test data synchronization**

## Troubleshooting

### Common Issues

1. **"Invalid redirect URI"**: Make sure your QuickBooks app is configured with the correct redirect URI
2. **"Company ID not found"**: Verify your Company ID is correct
3. **"Access token expired"**: Re-authenticate to get fresh tokens

### Debug Mode

Check the browser console and server logs for detailed error messages.

## Next Steps

1. **Test the integration** using the admin panel
2. **Set up automated syncing** (consider adding cron jobs or webhooks)
3. **Customize data mapping** based on your business needs
4. **Add error handling** for production use
5. **Set up token refresh** for long-term usage

## Security Notes

- Tokens are currently stored in the client (for testing)
- In production, implement secure token storage
- Consider using environment variables for sensitive configuration
- Implement proper error handling and logging
