/**
 * AL MARAKISH LIBRARY - OPAC ENGINE (NODE PORT)
 */

document.addEventListener('DOMContentLoaded', function () {
    // --- STATE MANAGEMENT ---
    let fetchedBooks = [];
    let filterTimeout;
    let isVoiceActive = false;

    // --- ELEMENT SELECTORS ---
    const mainSearch = document.getElementById('main-search');
    const searchBtn = document.getElementById('search-btn');
    const suggestionsBox = document.getElementById('search-suggestions');
    const booksGrid = document.getElementById('books-grid');
    const pagination = document.getElementById('pagination');
    const loading = document.getElementById('loading');
    const resultsCount = document.getElementById('results-count');
    const toggleAdvanced = document.getElementById('toggle-advanced');
    const advancedPanel = document.getElementById('advanced-search-panel');
    const applyFiltersBtn = document.getElementById('apply-filters-btn');
    const voiceBtn = document.getElementById('voice-search-btn');
    const micIndicator = document.getElementById('mic-indicator');
    const bookModal = document.getElementById('book-modal');
    const activeFiltersContainer = document.getElementById('active-filters');
    const clearAllBtn = document.getElementById('clear-all-filters');

    const filterInputs = {
        title: document.getElementById('filter-title'),
        author: document.getElementById('filter-author'),
        subject: document.getElementById('filter-subject'),
        language: document.getElementById('filter-language'),
        category: document.getElementById('filter-category'),
        publisher: document.getElementById('filter-publisher'),
        availability: document.getElementById('filter-availability'),
        year_from: document.getElementById('filter-year-from'),
        year_to: document.getElementById('filter-year-to'),
    };

    // --- INITIALIZATION ---
    checkAuth();
    loadFilters();
    loadRecentArrivals();
    loadBooks();
    setupFilterEvents();

    async function checkAuth() {
        const token = localStorage.getItem('token');
        if (!token) return;
        try {
            const response = await apiRequest('/auth/verify', { noRedirect: true });
            if (response.user) {
                const nav = document.getElementById('user-nav');
                nav.innerHTML = `
                    <div class="user-profile" style="display: flex; align-items: center; gap: 15px;">
                        <span style="font-size: 13px; font-weight: 600; color: var(--accent);">${response.user.full_name || response.user.username}</span>
                        <a href="#" id="logout-btn" class="btn-primary" style="padding: 8px 15px; font-size: 13px;">Logout</a>
                    </div>
                `;
                document.getElementById('logout-btn').onclick = async (e) => {
                    e.preventDefault();
                    await apiRequest('/auth/logout', { method: 'POST' });
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                    window.location.reload();
                };
            }
        } catch (err) {
            // Not logged in or invalid token
            localStorage.removeItem('token');
            localStorage.removeItem('user');
        }
    }

    async function loadFilters() {
        try {
            const data = await apiRequest('/opac/filters');
            if (data.success) {
                const populate = (id, list) => {
                    const el = document.getElementById(id);
                    if (!el) return;
                    list.forEach(item => {
                        const opt = document.createElement('option');
                        opt.value = item;
                        opt.textContent = item;
                        el.appendChild(opt);
                    });
                };
                populate('filter-language', data.languages);
                populate('filter-category', data.categories);
                populate('filter-publisher', data.publishers);
            }
        } catch (err) {
            console.error('Failed to load filters');
        }
    }

    async function loadRecentArrivals() {
        try {
            const data = await apiRequest('/opac/recent');
            if (data.success && data.books.length > 0) {
                const container = document.getElementById('new-arrivals-section');
                const slider = document.getElementById('arrivals-slider');
                container.style.display = 'block';
                slider.innerHTML = data.books.map(book => `
                    <div class="arrival-card" onclick="openBookModal(${book.id})" style="flex: 0 0 150px; cursor: pointer;">
                        <div class="arrival-img-wrapper" style="width: 100%; height: 200px; border-radius: 8px; overflow: hidden; background: #1e293b; display: flex; align-items: center; justify-content: center;">
                            <img src="${book.cover_image}" class="arrival-img" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                            <div class="placeholder-icon" style="display: none; flex-direction: column; align-items: center; gap: 5px; color: #475569;">
                                <i class="fas fa-book" style="font-size: 32px;"></i>
                                <span style="font-size: 8px; text-transform: uppercase;">No Cover</span>
                            </div>
                        </div>
                        <div style="font-size: 12px; font-weight: 700; color: white; margin-top: 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${book.title}</div>
                        <div style="font-size: 10px; color: var(--accent);">${book.author}</div>
                    </div>
                `).join('');
                initSlider();
            }
        } catch (err) {
            console.error('Failed to load recent arrivals');
        }
    }

    async function loadBooks(page = 1) {
        if (loading) loading.style.display = 'block';
        if (booksGrid) booksGrid.style.opacity = '0.5';

        const params = new URLSearchParams({
            q: mainSearch.value,
            page: page,
            f_title: filterInputs.title.value,
            f_author: filterInputs.author.value,
            f_subject: filterInputs.subject.value,
            f_language: filterInputs.language.value,
            f_category: filterInputs.category.value,
            f_publisher: filterInputs.publisher.value,
            f_availability: filterInputs.availability.value,
            f_year_from: filterInputs.year_from.value,
            f_year_to: filterInputs.year_to.value,
        });

        try {
            const data = await apiRequest(`/opac/search?${params.toString()}`);
            if (data.success) {
                fetchedBooks = data.books;
                renderBooks(data.books);
                renderPagination(data.pagination);
                renderActiveFilters();
                if (resultsCount) {
                    const count = data.pagination.total_books;
                    resultsCount.textContent = count > 0 ? `${count} books found` : 'No books found';
                }
            }
        } catch (err) {
            console.error('Search failed:', err);
        } finally {
            if (loading) loading.style.display = 'none';
            if (booksGrid) booksGrid.style.opacity = '1';
        }
    }

    function setupFilterEvents() {
        const instantFields = ['language', 'category', 'publisher', 'availability'];
        instantFields.forEach(key => {
            if (filterInputs[key]) {
                filterInputs[key].addEventListener('change', () => loadBooks(1));
            }
        });

        const textFields = ['title', 'author', 'subject', 'year_from', 'year_to'];
        textFields.forEach(key => {
            if (filterInputs[key]) {
                filterInputs[key].addEventListener('input', () => {
                    clearTimeout(filterTimeout);
                    filterTimeout = setTimeout(() => loadBooks(1), 500);
                });
            }
        });

        if (applyFiltersBtn) {
            applyFiltersBtn.onclick = () => {
                loadBooks(1);
                advancedPanel.classList.remove('show');
            };
        }

        if (clearAllBtn) {
            clearAllBtn.onclick = () => {
                mainSearch.value = '';
                Object.values(filterInputs).forEach(v => v.value = '');
                loadBooks(1);
            };
        }
    }

    function renderBooks(books) {
        if (!booksGrid) return;
        if (books.length === 0) {
            booksGrid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 100px 0;">No books found.</div>`;
            return;
        }

        booksGrid.innerHTML = books.map(book => `
            <div class="book-card" onclick="openBookModal(${book.id})" style="background: rgba(255,255,255,0.03); border-radius: 12px; overflow: hidden; cursor: pointer; border: 1px solid rgba(255,255,255,0.05); transition: transform 0.3s;">
                <div class="card-cover" style="position: relative; height: 350px; background: #1e293b; display: flex; align-items: center; justify-content: center;">
                    <img src="${book.cover_image}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                    <div class="placeholder-icon" style="display: none; flex-direction: column; align-items: center; gap: 10px; color: #475569;">
                        <i class="fas fa-book" style="font-size: 48px;"></i>
                        <span style="font-size: 10px; text-transform: uppercase; letter-spacing: 1px;">No Cover Available</span>
                    </div>
                    <span class="status-badge ${book.available ? 'available' : 'issued'}" style="position: absolute; top: 15px; right: 15px; padding: 5px 12px; border-radius: 20px; font-size: 10px; font-weight: 700; background: ${book.available ? '#10b981' : '#ef4444'}">${book.status_text}</span>
                </div>
                <div class="card-body" style="padding: 20px;">
                    <h3 style="font-size: 16px; margin-bottom: 5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${book.title}</h3>
                    <p style="color: var(--accent); font-size: 13px; margin-bottom: 10px;">by ${book.author}</p>
                    <div style="font-size: 11px; color: #94a3b8;"><i class="fas fa-barcode"></i> ${book.accession_number}</div>
                </div>
            </div>
        `).join('');
    }

    function renderPagination(pager) {
        if (!pagination) return;
        if (pager.total_pages <= 1) { pagination.innerHTML = ''; return; }

        let html = '';
        for (let i = 1; i <= pager.total_pages; i++) {
            if (i === 1 || i === pager.total_pages || (i >= pager.current_page - 2 && i <= pager.current_page + 2)) {
                html += `<button class="page-btn ${i === pager.current_page ? 'active' : ''}" data-page="${i}" style="margin: 0 5px; padding: 8px 15px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); background: ${i === pager.current_page ? 'var(--accent)' : 'transparent'}">${i}</button>`;
            }
        }
        pagination.innerHTML = html;
        pagination.querySelectorAll('.page-btn').forEach(btn => {
            btn.onclick = () => loadBooks(parseInt(btn.dataset.page));
        });
    }

    function renderActiveFilters() {
        if (!activeFiltersContainer) return;
        const active = [];
        if (mainSearch.value) active.push(`Search: ${mainSearch.value}`);
        if (filterInputs.category.value) active.push(`Category: ${filterInputs.category.value}`);

        activeFiltersContainer.innerHTML = active.map(f => `
            <div class="filter-tag" style="background: rgba(156,77,255,0.1); border: 1px solid var(--accent); padding: 5px 12px; border-radius: 20px; font-size: 12px; display: flex; align-items: center; gap: 8px;">
                <span>${f}</span>
            </div>
        `).join('');
    }

    if (mainSearch) {
        mainSearch.addEventListener('input', async function () {
            const query = this.value.trim();
            if (query.length < 2) { suggestionsBox.style.display = 'none'; return; }

            try {
                const data = await apiRequest(`/opac/autocomplete?q=${encodeURIComponent(query)}`);
                if (data.length > 0) {
                    suggestionsBox.innerHTML = data.map(item => `
                        <div class="suggestion-item" data-value="${item.text}" style="padding: 12px 20px; cursor: pointer; border-bottom: 1px solid rgba(255,255,255,0.05);">
                            <span>${item.text}</span> <small style="color: var(--accent); font-size: 10px; margin-left: 10px;">${item.type}</small>
                        </div>
                    `).join('');
                    suggestionsBox.style.display = 'block';
                } else {
                    suggestionsBox.style.display = 'none';
                }
            } catch (err) { }
        });

        document.addEventListener('click', e => {
            if (e.target.closest('.suggestion-item')) {
                mainSearch.value = e.target.closest('.suggestion-item').dataset.value;
                suggestionsBox.style.display = 'none';
                loadBooks(1);
            } else if (e.target !== mainSearch) {
                suggestionsBox.style.display = 'none';
            }
        });
    }

    if (searchBtn) searchBtn.onclick = () => loadBooks(1);
    if (toggleAdvanced) toggleAdvanced.onclick = () => advancedPanel.classList.toggle('show');

    window.openBookModal = function (id) {
        const book = fetchedBooks.find(b => b.id == id);
        if (!book) return;

        document.getElementById('modal-title').textContent = book.title;
        document.getElementById('modal-author').textContent = 'by ' + (book.author || 'Unknown');
        const modalCover = document.getElementById('modal-cover');
        modalCover.src = book.cover_image;
        modalCover.style.display = 'block';
        modalCover.onerror = function () {
            this.style.display = 'none';
            if (!this.parentElement.querySelector('.modal-placeholder')) {
                const placeholder = document.createElement('div');
                placeholder.className = 'modal-placeholder';
                placeholder.style.cssText = 'height: 400px; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #1a1a1a; color: #475569; border-radius: 12px;';
                placeholder.innerHTML = '<i class="fas fa-book" style="font-size: 80px; margin-bottom: 15px;"></i><span style="text-transform: uppercase; letter-spacing: 2px;">No Cover</span>';
                this.parentElement.appendChild(placeholder);
            }
        };

        // Clear previous placeholder if cover loads
        modalCover.onload = function () {
            const p = this.parentElement.querySelector('.modal-placeholder');
            if (p) p.remove();
        };

        const badge = document.getElementById('modal-availability');
        badge.textContent = book.status_text;
        badge.style.background = book.available ? '#10b981' : '#ef4444';

        document.getElementById('modal-category').textContent = book.category || 'N/A';
        document.getElementById('modal-language').textContent = book.language || 'N/A';
        document.getElementById('modal-isbn').textContent = book.isbn || 'N/A';
        document.getElementById('modal-acc').textContent = book.accession_number || 'N/A';
        document.getElementById('modal-year').textContent = book.publication_year || 'N/A';
        document.getElementById('modal-publisher').textContent = book.publisher || 'N/A';

        const reserveBtn = document.getElementById('modal-reserve-btn');
        if (book.available) {
            reserveBtn.style.display = 'block';
            reserveBtn.onclick = () => handleReservation(book.id);
        } else {
            reserveBtn.style.display = 'none';
        }

        bookModal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    };

    window.closeBookModal = function () {
        bookModal.style.display = 'none';
        document.body.style.overflow = '';
    };

    async function handleReservation(bookId) {
        try {
            const response = await apiRequest(`/opac/reserve/${bookId}`, {
                method: 'POST'
            });

            if (response.success) {
                await showModal({
                    title: 'Reservation Success',
                    message: `🎉 ${response.message}`,
                    type: 'alert',
                    confirmText: 'Great!'
                });
                closeBookModal();
                loadBooks(); // Refresh to show updated status if needed
            } else {
                const message = response.message || response.error;

                if (response.error === 'No token provided' || response.error === 'Invalid token') {
                    const login = await showModal({
                        title: 'Login Required',
                        message: 'You need to be logged in to reserve books. Would you like to login now?',
                        confirmText: 'Login Now',
                        cancelText: 'Later'
                    });
                    if (login) {
                        window.location.href = '/student/login.html?redirect=' + encodeURIComponent(window.location.href);
                    }
                } else {
                    showModal({
                        title: 'Reservation Status',
                        message: `🚨 ${message}`,
                        type: 'alert',
                        confirmText: 'Understood'
                    });
                }
            }
        } catch (err) {
            console.error('Reservation Error:', err);
            const msg = err.message || 'An unexpected error occurred.';

            if (msg.includes('login') || msg.includes('token')) {
                const login = await showModal({
                    title: 'Authentication Required',
                    message: 'Please login to reserve this book.',
                    confirmText: 'Go to Login',
                    cancelText: 'Cancel'
                });
                if (login) {
                    window.location.href = '/student/login.html?redirect=' + encodeURIComponent(window.location.href);
                }
            } else {
                showToast(msg, 'error');
            }
        }
    }

    function initSlider() {
        const slider = document.getElementById('arrivals-slider');
        const prev = document.getElementById('slider-prev');
        const next = document.getElementById('slider-next');
        if (!slider) return;

        prev.onclick = () => slider.scrollBy({ left: -300, behavior: 'smooth' });
        next.onclick = () => slider.scrollBy({ left: 300, behavior: 'smooth' });
    }

    window.onclick = (e) => { if (e.target === bookModal) closeBookModal(); };
});
