import { NextRequest, NextResponse } from "next/server";
import webpush from 'web-push';
import db from '@/lib/database';

// Configure web-push
webpush.setVapidDetails(
  'mailto:test@kinetic.com', // Your email
  'BF8E--_VAzbhkGHuK7icv2cAJm_O9pqqsfs-J-NFKvD3jEtCDTk7cy3RZdH3UtaZQoyxoq2vU2Qist8eBcpnX6Q', // Public key
  'DIq6wuPffIjUFnK6mXH6AawsGxwZCavkdburSSs1bH0' // Private key
);

export async function POST(request: NextRequest) {
  try {
    const { title, body, icon } = await request.json();
    
    console.log('Test notification requested:', { title, body, icon });
    
    // Get subscriptions from database
    try {
      // Get all subscriptions from database
      const subscriptions = await db.prepare('SELECT endpoint, p256dh, auth FROM push_subscriptions').all();
      
      if (!subscriptions || subscriptions.length === 0) {
        return NextResponse.json({ 
          success: false, 
          message: 'No subscriptions found' 
        });
      }
      
      let sentCount = 0;
      
      for (const sub of subscriptions) {
        if (sub.endpoint && sub.p256dh && sub.auth) {
          try {
            const subscription = {
              endpoint: sub.endpoint,
              keys: {
                p256dh: sub.p256dh,
                auth: sub.auth
              }
            };
            
            await webpush.sendNotification(subscription, JSON.stringify({
              title: title || 'Test Notification',
              body: body || 'This is a test notification from Kinetic App!',
              icon: icon || '/icons/icon-192x192.png',
              badge: '/icons/badge-72x72.png',
              tag: 'kinetic-notification',
              requireInteraction: true
            }));
            
            sentCount++;
            console.log('Notification sent to:', sub.endpoint);
          } catch (error) {
            console.error('Error sending notification to subscription:', error);
          }
        }
      }

      return NextResponse.json({ 
        success: true, 
        message: `Test notification sent to ${sentCount} subscribers` 
      });
    } catch (dbError) {
      console.error('Error getting subscriptions:', dbError);
      return NextResponse.json(
        { error: 'Failed to get subscriptions: ' + dbError.message },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error sending test notification:', error);
    return NextResponse.json(
      { error: 'Failed to send notification' },
      { status: 500 }
    );
  }
}
