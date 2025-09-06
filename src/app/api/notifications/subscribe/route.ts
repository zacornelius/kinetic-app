import { NextRequest, NextResponse } from "next/server";
import webpush from 'web-push';

// Configure web-push
webpush.setVapidDetails(
  'mailto:your-email@example.com', // Your email
  process.env.VAPID_PUBLIC_KEY || '',
  process.env.VAPID_PRIVATE_KEY || ''
);

export async function POST(request: NextRequest) {
  try {
    const subscription = await request.json();
    
    // Store subscription in database (you might want to add a subscriptions table)
    // For now, we'll just log it
    console.log('New push subscription:', subscription);
    
    // You could store this in your database:
    // const db = require('@/lib/database').default;
    // db.prepare(`
    //   INSERT OR REPLACE INTO push_subscriptions (endpoint, p256dh, auth, user_id)
    //   VALUES (?, ?, ?, ?)
    // `).run(
    //   subscription.endpoint,
    //   subscription.keys.p256dh,
    //   subscription.keys.auth,
    //   'anonymous' // You might want to associate with a user
    // );

    return NextResponse.json({ 
      success: true, 
      message: 'Subscription saved successfully' 
    });
  } catch (error) {
    console.error('Error saving subscription:', error);
    return NextResponse.json(
      { error: 'Failed to save subscription' },
      { status: 500 }
    );
  }
}
