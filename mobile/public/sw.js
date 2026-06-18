/* Service worker מינימלי — מאפשר התקנה ("הוספה למסך הבית") בלי לאחסן נתוני לקוח.
   רשת בלבד: אין מטמון של חשבוניות/כרטסת/PDF — הכל נשלף טרי מהשרת בכל פעם. */
self.addEventListener('install', (e) => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))
self.addEventListener('fetch', (event) => {
  // network-only — ללא שמירה. (קיום fetch handler נדרש להתקנת PWA.)
  if (event.request.method !== 'GET') return
  event.respondWith(fetch(event.request))
})
