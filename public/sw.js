// Service Worker for Team Kinetic Push Notifications v3
console.log('Service Worker v3 loaded');

self.addEventListener('push', function(event) {
    console.log('Push event received:', event);
    
    let notificationTitle = 'Customer Alert';
    let notificationBody = 'You have a new notification';
    let notificationData = { url: '/' };

    if (event.data) {
      try {
        const data = event.data.json();
        notificationBody = data.body || 'You have a new notification';
        notificationData = data.data || { url: '/' };
        console.log('Parsed notification data:', data);
      } catch (e) {
        console.error('Error parsing push data:', e);
      }
    }
    
    const options = {
        body: notificationBody,
        icon: '/icon-192x192.png',
        badge: '/icon-192x192.png',
        vibrate: [200, 100, 200],
        data: notificationData,
        actions: [
            {
                action: 'open',
                title: 'Open App',
                icon: '/icon-192x192.png'
            },
            {
                action: 'close',
                title: 'Close',
                icon: '/icon-192x192.png'
            }
        ]
    };

    console.log('Showing notification with title:', notificationTitle, 'and body:', notificationBody);

    event.waitUntil(
      self.registration.showNotification(notificationTitle, options)
    );
});

self.addEventListener('notificationclick', function(event) {
    console.log('Notification clicked:', event);
    
    event.notification.close();

    if (event.action === 'open' || !event.action) {
        event.waitUntil(
            clients.openWindow(event.notification.data.url || '/')
        );
    }
});

self.addEventListener('notificationclose', function(event) {
    console.log('Notification closed:', event);
});