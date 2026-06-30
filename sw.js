const CACHE_NAME = 'cliniflow-cache-v2';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/css/styles.css',
  '/js/app.js',
  '/js/db.js',
  '/js/auth.js',
  '/js/sync.js',
  '/js/ui.js',
  '/js/modules/dashboard.js',
  '/js/modules/patient.js',
  '/js/modules/triage.js',
  '/js/modules/consultation.js',
  '/js/modules/admissions.js',
  '/js/modules/pharmacy.js',
  '/js/modules/laboratory.js',
  '/js/modules/billing.js',
  '/js/modules/staff_appts_reports.js',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap',
  'https://fonts.googleapis.com/icon?family=Material+Icons+Round'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const isStatic = ASSETS_TO_CACHE.some(asset => event.request.url.includes(asset));

  if (isStatic) {
    event.respondWith(
      caches.match(event.request)
        .then((response) => response || fetch(event.request))
    );
  } else {
    event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
  }
});
