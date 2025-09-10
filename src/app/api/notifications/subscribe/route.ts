import { NextRequest, NextResponse } from "next/server";
import webpush from 'web-push';
import db from '@/lib/database';

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
    try {
      // Validate subscription object
      if (!subscription || !subscription.endpoint || !subscription.keys || !subscription.keys.p256dh || !subscription.keys.auth) {
        return NextResponse.json(
          { error: 'Invalid subscription object' },
          { status: 400 }
        );
      }
      
      // Use PostgreSQL to insert the subscription
      const sql = `INSERT INTO push_subscriptions (endpoint, p256dh, auth) VALUES ($1, $2, $3) ON CONFLICT (endpoint) DO UPDATE SET p256dh = $2, auth = $3`;
      
      await db.prepare(sql).run(subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth);
      
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
