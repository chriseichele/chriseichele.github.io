const CACHE_VERSION = 1;
let CURRENT_CACHES = {
    offline: 'offline-v' + CACHE_VERSION
};
const OFFLINE_URL = '/000.html';
var urlsToCache = [
  '/',
  '/impressum.html',
  '/assets/favicons/manifest.json',
  '/assets/style/screen.css',
  '/assets/script/main.js',
  '/assets/media/icon.svg',
  '/assets/media/icon-darkmode.svg',
  '/assets/media/portrait.jpg',
  '/assets/fonts/social-icons/icomoon.eot',
  '/assets/fonts/social-icons/icomoon.svg',
  '/assets/fonts/social-icons/icomoon.ttf',
  '/assets/fonts/social-icons/icomoon.woff',
  OFFLINE_URL
];

function fetchTimeout(url, options, timeout = 5000) {
    return Promise.race([
        fetch(url, options),
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error('timeout')), timeout)
        )
    ]);
};

function createCacheBustedRequest(url) {
    let request = new Request(url, {
        cache: 'reload'
    });
    // See https://fetch.spec.whatwg.org/#concept-request-mode
    // This is not yet supported in Chrome as of M48, so we need to explicitly check to see
    // if the cache: 'reload' option had any effect.
    if ('cache' in request) {
        return request;
    }

    // If {cache: 'reload'} didn't have any effect, append a cache-busting URL parameter instead.
    let bustedUrl = new URL(url, self.location.href);
    bustedUrl.search += (bustedUrl.search ? '&' : '') + 'cachebust=' + Date.now();
    return new Request(bustedUrl);
}

self.addEventListener('install', function (event) {
    // Perform install steps
    event.waitUntil(
        caches.open(CURRENT_CACHES.offline)
        .then(function (cache) {
            console.debug('Opened cache');
            cache.addAll(urlsToCache);
        }).then(function (cache) {
            fetch(createCacheBustedRequest(OFFLINE_URL)).then(function (response) {
                return caches.open(CURRENT_CACHES.offline).then(function (cache) {
                    return cache.put(OFFLINE_URL, response);
                });
            })
        })
    );
});

self.addEventListener('activate', event => {
    // Delete all caches that aren't named in CURRENT_CACHES.
    let expectedCacheNames = Object.keys(CURRENT_CACHES).map(function (key) {
        return CURRENT_CACHES[key];
    });

    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (expectedCacheNames.indexOf(cacheName) === -1) {
                        // If this cache name isn't present in the array of "expected" cache names,
                        // then delete it.
                        console.debug('Deleting out of date cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});


self.addEventListener('fetch', function (event) {
    // Clone Requests and add them to the cache

    caches.match(event.request)
        .then(function (response) {

            /* IMPORTANT: Clone the request (and response later, too).
            // A request/response is a stream and can only be consumed once.
            // Since we are consuming this
            // once by cache and once by the browser for fetch, we need
            // to clone the response.
            */
            var fetchRequest = event.request.clone();

            fetch(fetchRequest).catch(error => {
                return;
            }).then(
                function (response) {
                    // Check if we received a valid response
                    if (!response || response.status !== 200 || response.type !== 'basic') {
                        return;
                    }

                    var responseToCache = response.clone();

                    caches.open(CURRENT_CACHES.offline)
                        .then(function (cache) {
                            cache.put(event.request, responseToCache);
                            console.debug("UPDATED CACHE FOR URL ", fetchRequest.url);
                        });
                }
            );
        });
});

self.addEventListener('fetch', event => {
    // We only want to call event.respondWith() if this is a navigation request
    // for an HTML page.
    // request.mode of 'navigate' is unfortunately not supported in Chrome
    // versions older than 49, so we need to include a less precise fallback,
    // which checks for a GET request with an Accept: text/html header.
    if (event.request.mode === 'navigate' ||
        (event.request.method === 'GET'
            /* &&
                  event.request.headers.get('accept').includes('text/html') */
        )) {
        console.debug('Handling fetch event for', event.request.url);
        event.respondWith(
            fetchTimeout(event.request).catch(error => {
                // The catch is only triggered if fetch() throws an exception, which will most likely
                // happen due to the server being unreachable.
                // If fetch() returns a valid HTTP response with an response code in the 4xx or 5xx
                // range, the catch() will NOT be called. If you need custom handling for 4xx or 5xx
                // errors, see https://github.com/GoogleChrome/samples/tree/gh-pages/service-worker/fallback-response

                return caches.open(CURRENT_CACHES.offline).then(function (cache) {
                    return cache.match(event.request).then(function (response) {
                        if (response) {
                            console.debug('Returning response from cache for', event.request.url);
                            return response;
                        } else {
                            throw error;
                        }
                    }).catch(function (error) {
                        console.warn('Returning offline page instead of', event.request.url, error);
                        return caches.match(OFFLINE_URL);
                    });
                });
            })
        );
    }

    // If our if() condition is false, then this fetch handler won't intercept the request.
    // If there are any other fetch handlers registered, they will get a chance to call
    // event.respondWith(). If no fetch handlers call event.respondWith(), the request will be
    // handled by the browser as if there were no service worker involvement.
});
