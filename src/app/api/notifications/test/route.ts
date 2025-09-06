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
    const { title, body, icon } = await request.json();
    
    // In a real app, you'd get subscriptions from your database
    // For now, we'll just return success
    console.log('Test notification requested:', { title, body, icon });
    
    // Example of how you'd send to all subscribers:
    // const db = require('@/lib/database').default;
    // const subscriptions = db.prepare('SELECT * FROM push_subscriptions').all();
    
    // for (const subscription of subscriptions) {
    //   try {
    //     await webpush.sendNotification(subscription, JSON.stringify({
    //       title,
    //       body,
    //       icon: icon || '/icons/icon-192x192.png',
    //       badge: '/icons/badge-72x72.png',
    //       tag: 'kinetic-notification',
    //       requireInteraction: true,
    //       actions: [
    //         { action: 'open', title: 'Open App' },
    //         { action: 'dismiss', title: 'Dismiss' }
    //       ]
    //     }));
    //   } catch (error) {
    //     console.error('Error sending notification:', error);
    //   }
    // }

    return NextResponse.json({ 
      success: true, 
      message: 'Test notification sent' 
    });
  } catch (error) {
    console.error('Error sending test notification:', error);
    return NextResponse.json(
      { error: 'Failed to send notification' },
      { status: 500 }
    );
  }
}
