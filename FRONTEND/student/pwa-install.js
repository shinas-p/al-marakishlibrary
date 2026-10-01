// PWA Install Handler for AL MARAKISH LIBRARY
// Handles Progressive Web App installation prompts

let deferredPrompt;
let installButton;

// Listen for beforeinstallprompt event
window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent Chrome 67 and earlier from automatically showing the prompt
    e.preventDefault();
    // Stash the event so it can be triggered later
    deferredPrompt = e;

    // Show install button if it exists
    installButton = document.getElementById('installApp');
    if (installButton) {
        installButton.style.display = 'flex';

        installButton.addEventListener('click', () => {
            // Hide the install button
            installButton.style.display = 'none';

            // Show the install prompt
            deferredPrompt.prompt();

            // Wait for the user to respond to the prompt
            deferredPrompt.userChoice.then((choiceResult) => {
                if (choiceResult.outcome === 'accepted') {
                    console.log('User accepted the install prompt');
                } else {
                    console.log('User dismissed the install prompt');
                }
                deferredPrompt = null;
            });
        });
    }
});

// Log when app is installed
window.addEventListener('appinstalled', () => {
    console.log('AL MARAKISH LIBRARY PWA was installed');
    if (installButton) {
        installButton.style.display = 'none';
    }
});

// Service Worker Registration (optional - for offline capability)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        // Check if service-worker.js exists before registering
        fetch('/student/service-worker.js', { method: 'HEAD' })
            .then(() => {
                navigator.serviceWorker.register('/student/service-worker.js')
                    .then(reg => console.log('Service Worker registered'))
                    .catch(err => console.log('Service Worker registration failed'));
            })
            .catch(() => {
                // Service worker file doesn't exist, that's okay
                console.log('PWA features available without service worker');
            });
    });
}
