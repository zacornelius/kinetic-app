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
    const sqlite3 = require('sqlite3').verbose();
    const db = new sqlite3.Database('./kinetic.db');
    
    return new Promise((resolve) => {
      db.run(`
        INSERT OR REPLACE INTO push_subscriptions (endpoint, p256dh, auth)
        VALUES (?, ?, ?)
      `, [
        subscription.endpoint,
        subscription.keys.p256dh,
        subscription.keys.auth
      ], function(err) {
        if (err) {
          console.error('Error saving subscription:', err);
          resolve(NextResponse.json(
            { error: 'Failed to save subscription' },
            { status: 500 }
          ));
        } else {
          console.log('Subscription saved successfully');
          resolve(NextResponse.json({ 
            success: true, 
            message: 'Subscription saved successfully' 
          }));
        }
        db.close();
      });
    });
  } catch (error) {
    console.error('Error saving subscription:', error);
    return NextResponse.json(
      { error: 'Failed to save subscription' },
      { status: 500 }
    );
  }
}
