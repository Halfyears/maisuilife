// Service worker for 麦穗喜乐 (MaisuiJoy) push notifications

self.addEventListener('push', function (event) {
  if (!event.data) return

  let payload
  try {
    payload = event.data.json()
  } catch {
    payload = { title: '麦穗喜乐', body: event.data.text() }
  }

  const title   = payload.title ?? '麦穗喜乐'
  const options = {
    body:    payload.body ?? '',
    icon:    '/icons/icon-192.png',
    badge:   '/icons/badge-72.png',
    data:    { url: payload.url ?? '/' },
    vibrate: [100, 50, 100],
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', function (event) {
  event.notification.close()
  const url = event.notification.data?.url ?? '/'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      if (clients.openWindow) return clients.openWindow(url)
    })
  )
})
