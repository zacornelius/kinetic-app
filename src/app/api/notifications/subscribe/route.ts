import { NextRequest, NextResponse } from "next/server";
import webpush from 'web-push';

// Configure web-push
webpush.setVapidDetails(
  'mailto:test@kinetic.com', // Your email
  'BFaG3z0R7CrT_J6CIB3G3YdumRrQUBXdsGnsEEZQL7cygZqtefy_ausFswT428tkHuY81pSCs2nj3jXB-255buk', // Public key
  'x5AizQr8aWPGlp4uuPAd7UZzSLkrwN691adabOOrga8' // Private key
);

export async function POST(request: NextRequest) {
  try {
    const subscription = await request.json();
    
    
    // Store subscription in database
    const { execSync } = require('child_process');
    
    try {
      // Validate subscription object
      if (!subscription || !subscription.endpoint || !subscription.keys || !subscription.keys.p256dh || !subscription.keys.auth) {
        return NextResponse.json(
          { error: 'Invalid subscription object' },
          { status: 400 }
        );
      }
      
      // Use sqlite3 command line to insert the subscription
      const endpoint = subscription.endpoint.replace(/'/g, "''");
      const p256dh = subscription.keys.p256dh.replace(/'/g, "''");
      const auth = subscription.keys.auth.replace(/'/g, "''");
      
      const sql = `INSERT OR REPLACE INTO push_subscriptions (endpoint, p256dh, auth) VALUES ('${endpoint}', '${p256dh}', '${auth}')`;
      
      execSync(`sqlite3 kinetic.db "${sql}"`, { stdio: 'pipe' });
      
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
