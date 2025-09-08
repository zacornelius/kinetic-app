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
    const { title, body, category } = await request.json();
    
    
    // Get all push subscriptions from database
    const { execSync } = require('child_process');
    
    try {
      const sql = `SELECT endpoint, p256dh, auth FROM push_subscriptions`;
      const result = execSync(`sqlite3 kinetic.db "${sql}"`, { stdio: 'pipe' });
      
      if (!result || result.toString().trim() === '') {
        return NextResponse.json({ 
          success: true, 
          message: 'No subscriptions to notify',
          sent: 0
        });
      }
      
      const subscriptions = result.toString().trim().split('\n').map(line => {
        const [endpoint, p256dh, auth] = line.split('|');
        return {
          endpoint,
          keys: {
            p256dh,
            auth
          }
        };
      });
      
      
      // Send notification to all subscriptions
      const notifications = subscriptions.map(async (subscription) => {
        try {
          const payload = JSON.stringify({
            body: body || 'New notification',
            icon: '/icon-192x192.png',
            badge: '/icon-192x192.png',
            data: {
              category: category || 'general',
              url: '/'
            }
          });
          
          await webpush.sendNotification(subscription, payload);
          return { success: true };
        } catch (error) {
          console.error('Error sending notification:', error);
          return { success: false, error: error.message };
        }
      });
      
      const results = await Promise.all(notifications);
      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;
      
      
      return NextResponse.json({ 
        success: true, 
        message: `Notifications sent: ${successful} successful, ${failed} failed`,
        sent: successful,
        failed: failed
      });
      
    } catch (dbError) {
      console.error('Error getting subscriptions:', dbError);
      return NextResponse.json(
        { error: 'Failed to get subscriptions: ' + dbError.message },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error sending notifications:', error);
    return NextResponse.json(
      { error: 'Failed to send notifications' },
      { status: 500 }
    );
  }
}
