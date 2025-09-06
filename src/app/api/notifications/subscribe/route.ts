import { NextRequest, NextResponse } from "next/server";
import webpush from 'web-push';

// Configure web-push
webpush.setVapidDetails(
  'mailto:test@kinetic.com', // Your email
  'BF8E--_VAzbhkGHuK7icv2cAJm_O9pqqsfs-J-NFKvD3jEtCDTk7cy3RZdH3UtaZQoyxoq2vU2Qist8eBcpnX6Q', // Public key
  'DIq6wuPffIjUFnK6mXH6AawsGxwZCavkdburSSs1bH0' // Private key
);

export async function POST(request: NextRequest) {
  try {
    const subscription = await request.json();
    
    console.log('New push subscription:', subscription);
    
    // Store subscription in database
    const { execSync } = require('child_process');
    
    try {
      // Use sqlite3 command line to insert the subscription
      const endpoint = subscription.endpoint.replace(/'/g, "''");
      const p256dh = subscription.keys.p256dh.replace(/'/g, "''");
      const auth = subscription.keys.auth.replace(/'/g, "''");
      
      const sql = `INSERT OR REPLACE INTO push_subscriptions (endpoint, p256dh, auth) VALUES ('${endpoint}', '${p256dh}', '${auth}')`;
      
      execSync(`sqlite3 kinetic.db "${sql}"`, { stdio: 'pipe' });
      
      console.log('Subscription saved successfully');
      return NextResponse.json({ 
        success: true, 
        message: 'Subscription saved successfully' 
      });
    } catch (dbError) {
      console.error('Error saving subscription:', dbError);
      return NextResponse.json(
        { error: 'Failed to save subscription: ' + dbError.message },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error saving subscription:', error);
    return NextResponse.json(
      { error: 'Failed to save subscription' },
      { status: 500 }
    );
  }
}
