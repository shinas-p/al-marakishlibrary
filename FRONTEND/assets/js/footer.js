/**
 * Footer Component Loader
 * Automatically loads the footer component on any page
 */

function loadFooter() {
    // Create footer container if it doesn't exist
    let footerContainer = document.getElementById('footer-container');

    if (!footerContainer) {
        footerContainer = document.createElement('div');
        footerContainer.id = 'footer-container';
        document.body.appendChild(footerContainer);
    }

    // Fetch and inject footer
    fetch('/components/footer.html')
        .then(response => {
            if (!response.ok) throw new Error('Footer fetch failed: ' + response.status);
            return response.text();
        })
        .then(data => {
            footerContainer.innerHTML = data;
            console.log('Footer loaded successfully');
        })
        .catch(err => {
            console.error('Error loading footer:', err);
        });
}

// Auto-load footer when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadFooter);
} else {
    loadFooter();
}
