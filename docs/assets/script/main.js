navigator.vibrate = navigator.vibrate || navigator.webkitVibrate || navigator.mozVibrate || navigator.msVibrate;

/* cookie utility methods */

function deleteCookie(cname) {
    document.cookie = cname + '=;expires=Thu, 01 Jan 1970 00:00:01 GMT;';
    console.debug('Cookie is deleted:', cname);
}

function setCookie(cname, value, minutes = 0) {
    var cookie = cname + '=' + escape(value) + ';';
    /* cookie without expiration date gets deleted if browser is closed */
    if (minutes > 0) {
        var now = new Date();
        now.setTime(now.getTime() + (minutes * 60 * 1000));
        cookie += 'expires=' + now.toUTCString() + ';max-age=' + minutes * 60 + ';';
    }
    console.debug('Cookie is set:', cookie);
    document.cookie = cookie;
}

function getCookie(cname) {
    var name = cname + "=";
    var ca = document.cookie.split(';');
    for (var i = 0; i < ca.length; i++) {
        var c = ca[i];
        while (c.charAt(0) == ' ') {
            c = c.substring(1);
        }
        if (c.indexOf(name) == 0) {
            return c.substring(name.length, c.length);
        }
    }
    return "";
}

/* dark mode detection */

const html = document.querySelector('html');

function initDarkModeDetection() {
    if (window.matchMedia("screen").matches) {

        if (getCookie('dark-mode') == "true") {
            activateDarkMode();
        }

        /* check, if dark mode is active via css media query */
        let cssDarkMode = window.matchMedia("(prefers-color-scheme: dark)").matches;
        let cssLightMode = window.matchMedia("(prefers-color-scheme: light)").matches;

        if (cssDarkMode || cssLightMode) {
            console.info('Dark Mode is activated based on CSS media queries.');
        } else {
            /* if there is no css dark/light mode preference
               activate dark mode, if ambient light is dark (with custom css class) */
            if (window.AmbientLightSensor) {
                console.info('Dark Mode is activated based on ambient light sensor.');
                let sensor = new AmbientLightSensor();
                sensor.addEventListener('error', event => {
                    console.error('Ambient light sensor error:', event.error.name);
                    if (event.error.name == 'NotAllowedError') {
                        sensor.stop();
                        initDarkModeBasedOnTime();
                    }
                });
                sensor.addEventListener('reading', () => {
                    let illuminance = sensor.illuminance;
                    console.debug('Ambient illuminance: ', illuminance);
                    if (illuminance < 15) {
                        activateDarkMode();
                    } else if (illuminance > 25) {
                        deactivateDarkMode();
                    }
                });
                sensor.start();
            } else {
                /* if there is no ambient sensor available, 
                   activate dark mode at nighttime (with custom css class) */
                initDarkModeBasedOnTime();
            }
        }
        /* else, it defaults to light mode */
    }
}

function initDarkModeBasedOnTime() {
    console.info('Dark Mode is activated at night between 8pm and 6am.');
    setDarkModeBasedOnTime(0);
}

function setDarkModeBasedOnTime(t) {
    setTimeout(function () {
        let d = new Date();
        let h = d.getHours();
        if (h >= 20 || h < 6) {
            activateDarkMode();
        } else {
            deactivateDarkMode();
        }
        setDarkModeBasedOnTime(1000 * 60 * 60);
    }, t);
}

function activateDarkMode() {
    if (!html.classList.contains('darkmode')) {
        html.classList.add('darkmode');
        setCookie('dark-mode', 'true');
    }
}

function deactivateDarkMode() {
    if (html.classList.contains('darkmode')) {
        html.classList.remove('darkmode');
        deleteCookie('dark-mode');
    }
}

/* Service Worker */

function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', function () {
            navigator.serviceWorker.register('./sw.js').then(function (registration) {
                // Registration was successful
                console.info('ServiceWorker registration successful with scope: ', registration.scope);
            }).catch(function (err) {
                // registration failed :(
                console.error('ServiceWorker registration failed: ', err);
            });
        });
    }
    registerInstallPromptListener();
}

function registerInstallPromptListener() {
    window.addEventListener('beforeinstallprompt', function (e) {
        // beforeinstallprompt Event fired

        // e.userChoice will return a Promise.
        // For more details read: https://developers.google.com/web/fundamentals/getting-started/primers/promises
        e.userChoice.then(function (choiceResult) {

            console.log(choiceResult.outcome);

            if (choiceResult.outcome == 'dismissed') {
                console.info('User cancelled WebApp home screen install.');
                trackAppInstall('WebApp', 'dismissed');
            } else {
                console.info('User added WebApp to home screen.');
                trackAppInstall('WebApp', 'installed');
            }
        });
    });
}


/* resize landing page text box */

const resizer = document.getElementById("resizer1");
const resizeable = document.getElementById("resizeable1");

function initResizeable() {
    resizer.addEventListener('mousedown', initResize, false);
    resizer.addEventListener('touchstart', initResize, {
        passive: true
    }, false);

    let w = getCookie('landingpage-resize-width');
    if (w != '' && !isNaN(w)) {
        setWidth(w);
    }
}

function initResize(e) {
    if (navigator.vibrate) {
        navigator.vibrate(50);
    }
    window.addEventListener('mousemove', Resize, false);
    window.addEventListener('touchmove', Resize, {
        passive: true
    }, false);
    window.addEventListener('mouseup', stopResize, false);
    window.addEventListener('touchend', stopResize, {
        passive: true
    }, false);
    window.addEventListener('touchcancel', stopResize, {
        passive: true
    }, false);
}

function Resize(e) {
    try {
        var x = e.clientX || e.targetTouches[0].pageX;
        setWidth((window.innerWidth - x) / window.innerWidth * 100);
    } catch (e) {
        if (!(e instanceof TypeError)) {
            console.log(e);
        }
    }
}

function setWidth(w) {
    if (w > 100) {
        w = 100;
    }
    if (w < 10) {
        w = 10;
    }
    resizeable.style.width = (w + '%');
    setCookie('landingpage-resize-width', w);
}

function stopResize(e) {
    window.removeEventListener('mousemove', Resize, false);
    window.removeEventListener('touchmove', Resize, {
        passive: true
    }, false);
    window.removeEventListener('mouseup', stopResize, false);
    window.removeEventListener('touchend', stopResize, {
        passive: true
    }, false);
    window.removeEventListener('touchcancel', stopResize, {
        passive: true
    }, false);
}
