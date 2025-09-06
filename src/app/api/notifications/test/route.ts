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
    
    console.log('Test notification requested:', { title, body, icon });
    
    // Get subscriptions from database
    const { execSync } = require('child_process');
    
    try {
      // Get all subscriptions from database
      const subscriptionsJson = execSync('sqlite3 kinetic.db "SELECT endpoint, p256dh, auth FROM push_subscriptions"', { encoding: 'utf8' });
      
      if (!subscriptionsJson.trim()) {
        return NextResponse.json({ 
          success: false, 
          message: 'No subscriptions found' 
        });
      }
      
      const lines = subscriptionsJson.trim().split('\n');
      let sentCount = 0;
      
      for (const line of lines) {
        const [endpoint, p256dh, auth] = line.split('|');
        
        if (endpoint && p256dh && auth) {
          try {
            const subscription = {
              endpoint,
              keys: {
                p256dh,
                auth
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
            console.log('Notification sent to:', endpoint);
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
