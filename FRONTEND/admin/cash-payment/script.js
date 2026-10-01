/**
 * Cash Fine Payment Module
 * Handles student search, book selection, live preview, and PDF receipt generation.
 */

// State Management
let selectedStudent = null;
let selectedBook = null;
let borrowedBooks = [];
let searchTimeout = null;
let currentFocus = -1;
let fineRate = 0; // Daily fine rate from settings

// Constants
const API_BASE = '../../api';

// DOM Elements
const elements = {
    studentSearch: document.getElementById('studentSearch'),
    searchDropdown: document.getElementById('searchDropdown'),
    studentDetails: document.getElementById('studentDetails'),
    bookSelectionCard: document.getElementById('bookSelectionCard'),
    borrowedBooksList: document.getElementById('borrowedBooksList'),
    paymentFormCard: document.getElementById('paymentFormCard'),
    fineAmount: document.getElementById('fineAmount'),
    paymentDate: document.getElementById('paymentDate'),
    paymentNotes: document.getElementById('paymentNotes'),
    noBookOption: document.getElementById('noBookOption'),
    submitBtn: document.getElementById('submitBtn'),
    successModal: document.getElementById('successModal'),
    downloadReceiptBtn: document.getElementById('downloadReceiptBtn'),
    newPaymentBtn: document.getElementById('newPaymentBtn'),
    libraryName: document.getElementById('libraryName'),
    adminName: document.getElementById('adminName'),
    adminPhoto: document.getElementById('adminPhoto'),

    // Preview
    prevStudent: document.getElementById('prevStudent'),
    prevID: document.getElementById('prevID'),
    prevBook: document.getElementById('prevBook'),
    prevBookID: document.getElementById('prevBookID'),
    prevDays: document.getElementById('prevDays'),
    prevTotal: document.getElementById('prevTotal'),
    prevDate: document.getElementById('prevDate'),
    prevNotes: document.getElementById('prevNotes')
};

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    // Set default date to today
    elements.paymentDate.valueAsDate = new Date();
    updatePreview();

    // Load admin info
    const user = getUser();
    if (user) {
        elements.adminName.textContent = user.username || user.full_name || 'Admin';
        if (elements.adminPhoto) {
            const adminAvatar = user.profile_photo
                ? `/uploads/users/${user.profile_photo}`
                : `https://ui-avatars.com/api/?name=${encodeURIComponent(user.username || 'A')}&background=00e5ff&color=000`;
            elements.adminPhoto.src = adminAvatar;
            elements.adminPhoto.style.display = 'block';
        }
    }

    // Event Listeners
    elements.studentSearch.addEventListener('input', handleSearch);
    elements.studentSearch.addEventListener('keydown', handleSearchNav);
    elements.fineAmount.addEventListener('input', updatePreview);
    elements.paymentDate.addEventListener('change', updatePreview);
    elements.paymentNotes.addEventListener('input', updatePreview);
    elements.submitBtn.addEventListener('click', handleSubmit);
    elements.newPaymentBtn.addEventListener('click', () => window.location.reload());
    elements.noBookOption.addEventListener('click', () => selectBook(null));

    // Close dropdown on click outside
    document.addEventListener('click', (e) => {
        if (!elements.searchDropdown.contains(e.target) && e.target !== elements.studentSearch) {
            elements.searchDropdown.classList.add('hidden');
        }
    });

    // Fetch Library info if available
    fetchLibraryInfo();
});

// --- API Functions ---

async function fetchLibraryInfo() {
    try {
        const response = await apiRequest('/settings/public');
        if (response.success && response.settings) {
            elements.libraryName.textContent = response.settings.library_name || 'Al Marakish Library';
            fineRate = parseFloat(response.settings.fine_per_day_student) || 0;
            console.log('Fine rate loaded:', fineRate);
        }
    } catch (err) {
        console.warn('Branding fetch failed, using default');
        elements.libraryName.textContent = 'Al Marakish Library';
    }
}

async function handleSearch(e) {
    const query = e.target.value.trim();
    if (query.length < 2) {
        elements.searchDropdown.classList.add('hidden');
        return;
    }

    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(async () => {
        try {
            // Updated to use the requested endpoint
            const response = await apiRequest(`/students/search?query=${encodeURIComponent(query)}`);
            if (response.success && response.users) {
                renderDropdown(response.users);
            }
        } catch (err) {
            console.error('Search error:', err);
        }
    }, 300);
}

function renderDropdown(users) {
    if (users.length === 0) {
        elements.searchDropdown.classList.add('hidden');
        return;
    }

    elements.searchDropdown.innerHTML = users.map((user, index) => {
        const fallbackAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.full_name)}&background=cf9d7c&color=fff`;
        const avatar = user.profile_photo
            ? `/uploads/students/${user.profile_photo}`
            : fallbackAvatar;

        return `
        <div class="suggestion-item" data-id="${user.id}" data-index="${index}">
            <img src="${avatar}" onerror="this.src='${fallbackAvatar}'" alt="">
            <div class="s-info">
                <h4>${user.full_name}</h4>
                <p>${user.ad_no} | ${user.section || 'No Class'}</p>
            </div>
        </div>
        `;
    }).join('');

    elements.searchDropdown.classList.remove('hidden');
    currentFocus = -1;

    // Click selection
    document.querySelectorAll('.suggestion-item').forEach(item => {
        item.addEventListener('click', () => {
            const studentId = item.getAttribute('data-id');
            const user = users[item.getAttribute('data-index')];
            selectStudent(user);
        });
    });
}

function handleSearchNav(e) {
    const items = elements.searchDropdown.querySelectorAll('.suggestion-item');
    if (items.length === 0) return;

    if (e.key === 'ArrowDown') {
        currentFocus++;
        addActive(items);
    } else if (e.key === 'ArrowUp') {
        currentFocus--;
        addActive(items);
    } else if (e.key === 'Enter') {
        e.preventDefault();
        if (currentFocus > -1) {
            items[currentFocus].click();
        }
    }
}

function addActive(items) {
    if (!items) return false;
    items.forEach(item => item.classList.remove('selected'));
    if (currentFocus >= items.length) currentFocus = 0;
    if (currentFocus < 0) currentFocus = items.length - 1;
    items[currentFocus].classList.add('selected');
    items[currentFocus].scrollIntoView({ block: 'nearest' });
}

async function selectStudent(user) {
    selectedStudent = user;
    elements.studentSearch.value = user.full_name;
    elements.searchDropdown.classList.add('hidden');

    // Show details
    elements.studentDetails.classList.remove('hidden');
    document.getElementById('fillName').textContent = user.full_name;
    document.getElementById('fillClass').textContent = user.section || '--';
    document.getElementById('fillPhone').textContent = user.contact || user.phone || '--';
    document.getElementById('fillEmail').textContent = user.email || '--';

    // Update preview
    elements.prevStudent.textContent = user.full_name;
    elements.prevID.textContent = user.ad_no;

    // Fetch borrowed books
    fetchBorrowedBooks(user.id);

    // Auto-fill form and show
    elements.paymentFormCard.classList.remove('hidden');
    updatePreview();
}

async function fetchBorrowedBooks(studentId) {
    try {
        elements.bookSelectionCard.classList.remove('hidden');
        elements.borrowedBooksList.innerHTML = '<div class="loading">Loading books...</div>';

        const response = await apiRequest(`/students/borrowed/${studentId}`);
        if (response.success) {
            borrowedBooks = response.transactions;
            renderBooksList();

            // Auto-fill total fine amount
            if (fineRate > 0) {
                const totalFine = borrowedBooks.reduce((acc, book) => {
                    const accrued = book.status === 'Returned' ? parseFloat(book.fine || 0) : (Math.max(0, book.days_late) * fineRate);
                    return acc + Math.max(0, accrued - parseFloat(book.fine_paid || 0));
                }, 0);
                elements.fineAmount.value = totalFine.toFixed(2);
                updatePreview();
            }
        }
    } catch (err) {
        elements.borrowedBooksList.innerHTML = '<p class="error">Failed to load books.</p>';
    }
}

function renderBooksList() {
    if (borrowedBooks.length === 0) {
        elements.borrowedBooksList.innerHTML = '<p class="text-muted">No currently borrowed books.</p>';
        return;
    }

    elements.borrowedBooksList.innerHTML = borrowedBooks.map(t => {
        const accruedFine = t.status === 'Returned' ? parseFloat(t.fine || 0) : (Math.max(0, t.days_late) * fineRate);
        const paid = parseFloat(t.fine_paid || 0);
        const remaining = Math.max(0, accruedFine - paid);
        const isPaid = (remaining <= 0 && accruedFine > 0) || t.fine_status === 'Paid';

        return `
        <div class="book-card ${selectedBook && selectedBook.id === t.id ? 'selected' : ''} ${isPaid ? 'fully-paid' : ''}" 
             data-tid="${t.id}" data-bid="${t.book_id}">
            <div class="book-badge-container">
                ${(t.days_late > 0 && !isPaid) ? `<span class="late-badge">${t.days_late} Days Late</span>` : ''}
                ${isPaid ? `<span class="paid-badge"><i class="fas fa-check-circle"></i> PAID</span>` : ''}
                ${!isPaid && paid > 0 ? `<span class="partial-badge">₹${paid} PAID</span>` : ''}
            </div>
            <h4>${t.title}</h4>
            <div class="book-meta">
                <span class="meta-item"><i class="fas fa-barcode"></i> ${t.accession_number}</span>
                <span class="meta-item"><i class="fas fa-calendar"></i> ${t.status === 'Returned' ? 'Returned' : 'Due'}: ${new Date(t.status === 'Returned' ? t.return_date : t.due_date).toLocaleDateString()}</span>
            </div>
            ${!isPaid && accruedFine > 0 ? `
            <div class="fine-mini-summary">
                <span class="accrued">Total: ₹${accruedFine.toFixed(2)}</span>
                <span class="balance">Balance: <strong>₹${remaining.toFixed(2)}</strong></span>
            </div>
            ` : ''}
        </div>
        `;
    }).join('');

    document.querySelectorAll('.book-card').forEach(card => {
        card.addEventListener('click', () => {
            const tid = card.getAttribute('data-tid');
            const book = borrowedBooks.find(b => b.id == tid);
            selectBook(book);
        });
    });
}

function selectBook(book) {
    selectedBook = book;

    // UI Update
    document.querySelectorAll('.book-card').forEach(c => c.classList.remove('selected'));
    elements.noBookOption.classList.remove('selected');

    if (book) {
        const card = document.querySelector(`.book-card[data-tid="${book.id}"]`);
        if (card) card.classList.add('selected');

        // Auto-calculate suggested fine
        if (fineRate > 0) {
            const accruedFine = book.status === 'Returned' ? parseFloat(book.fine || 0) : (book.days_late * fineRate);
            const remaining = Math.max(0, accruedFine - parseFloat(book.fine_paid || 0));
            elements.fineAmount.value = remaining.toFixed(2);
        } else if (book.status === 'Returned') {
            const remaining = Math.max(0, parseFloat(book.fine || 0) - parseFloat(book.fine_paid || 0));
            elements.fineAmount.value = remaining.toFixed(2);
        } else {
            elements.fineAmount.value = '0.00';
        }
    } else {
        elements.noBookOption.classList.add('selected');

        // If selecting general, show the total fine for all books
        if (fineRate > 0) {
            const totalFine = borrowedBooks.reduce((acc, b) => {
                const accrued = b.status === 'Returned' ? parseFloat(b.fine || 0) : (Math.max(0, b.days_late) * fineRate);
                return acc + Math.max(0, accrued - parseFloat(b.fine_paid || 0));
            }, 0);
            elements.fineAmount.value = totalFine.toFixed(2);
        }
    }

    updatePreview();
}

function updatePreview() {
    const amount = parseFloat(elements.fineAmount.value) || 0;
    const notes = elements.paymentNotes.value.trim();
    const dateStr = elements.paymentDate.value;

    elements.prevStudent.textContent = selectedStudent ? selectedStudent.full_name : 'No Student Selected';
    elements.prevID.textContent = selectedStudent ? selectedStudent.ad_no : '--';

    elements.prevBook.textContent = selectedBook ? selectedBook.title : 'General / Other';
    elements.prevBookID.textContent = selectedBook ? selectedBook.accession_number : '--';
    elements.prevDays.textContent = selectedBook ? selectedBook.days_late : '0';

    elements.prevTotal.textContent = `₹ ${amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    elements.prevDate.textContent = dateStr ? new Date(dateStr).toLocaleDateString() : '--';
    elements.prevNotes.textContent = notes || 'No notes added.';

    // Validate button state
    const isValid = selectedStudent && amount > 0;
    elements.submitBtn.disabled = !isValid;
}

async function handleSubmit() {
    if (!selectedStudent || !elements.fineAmount.value) {
        alert('Please select a student and enter fine amount.');
        return;
    }

    try {
        elements.submitBtn.disabled = true;
        elements.submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Recording...';

        const payload = {
            student_id: selectedStudent.id,
            transaction_id: selectedBook ? selectedBook.id : null,
            book_id: selectedBook ? selectedBook.book_id : null,
            amount: parseFloat(elements.fineAmount.value),
            reason: selectedBook ? `Late Return Fine: ${selectedBook.title}` : 'Library Fine',
            notes: elements.paymentNotes.value.trim()
        };

        const response = await apiRequest('/fines/cash-payment', {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        if (response.success) {
            showSuccess(response);
        } else {
            // Enhanced error message
            const errorMsg = response.details ?
                `❌ ${response.error || 'Payment Failed'}\n\n${response.details}` :
                `❌ ${response.error || 'Payment Failed'}`;
            alert(errorMsg);

            elements.submitBtn.innerHTML = '<span>Record Payment</span><i class="fas fa-check-double"></i>';
            elements.submitBtn.disabled = false;
        }
    } catch (err) {
        console.error('Submission failed:', err);
        alert('🚨 Critical Error: ' + err.message);
        elements.submitBtn.innerHTML = '<span>Record Payment</span><i class="fas fa-check-double"></i>';
        elements.submitBtn.disabled = false;
    }
}

let lastResponseData = null;

function showSuccess(response) {
    lastResponseData = response;
    elements.successModal.classList.remove('hidden');

    elements.downloadReceiptBtn.onclick = () => generatePDFReceipt(response);
}

// --- PDF Generation ---

function generatePDFReceipt(data) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    const receiptNo = data.receipt_data.receipt_no;
    const date = new Date(data.receipt_data.date).toLocaleString();
    const amount = parseFloat(elements.fineAmount.value).toFixed(2);

    // Design Settings
    const primaryColor = [26, 46, 46]; // #1a2e2e
    const goldColor = [207, 157, 124]; // #cf9d7c

    // Header
    doc.setFillColor(...primaryColor);
    doc.rect(0, 0, 210, 40, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(24);
    doc.text(elements.libraryName.textContent, 105, 20, { align: 'center' });

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('OFFICIAL FINE RECEIPT (CASHSETTLEMENT)', 105, 28, { align: 'center' });

    // Receipt Info
    doc.setTextColor(50, 50, 50);
    doc.setFontSize(12);
    doc.text(`Receipt No: ${receiptNo}`, 20, 55);
    doc.text(`Date: ${date}`, 140, 55);

    doc.setDrawColor(200, 200, 200);
    doc.line(20, 60, 190, 60);

    // Student Details
    doc.setFont('helvetica', 'bold');
    doc.text('STUDENT INFORMATION', 20, 75);
    doc.setFont('helvetica', 'normal');
    doc.text(`Name: ${selectedStudent.full_name}`, 20, 85);
    doc.text(`ID: ${selectedStudent.ad_no}`, 20, 92);
    doc.text(`Class: ${selectedStudent.section || 'N/A'}`, 140, 85);

    // Payment Details
    doc.setFont('helvetica', 'bold');
    doc.text('PAYMENT DETAILS', 20, 110);
    doc.line(20, 113, 190, 113);

    // Table-like structure
    doc.text('Description', 25, 122);
    doc.text('Amount', 160, 122);

    doc.setFont('helvetica', 'normal');
    const desc = selectedBook
        ? `Fine for: ${selectedBook.title} (${selectedBook.accession_number || '--'})`
        : 'General Library Fine / Custom Charge';

    // Multi-line description if long
    const splitDesc = doc.splitTextToSize(desc, 120);
    doc.text(splitDesc, 25, 132);

    doc.setFont('helvetica', 'bold');
    doc.text(`INR ${amount}`, 160, 132);

    if (selectedBook && selectedBook.days_late > 0) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'italic');
        doc.text(`Days Late: ${selectedBook.days_late}`, 25, 145);
    }

    // Notes
    if (elements.paymentNotes.value.trim()) {
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text('Notes:', 20, 160);
        doc.setFont('helvetica', 'normal');
        doc.text(doc.splitTextToSize(elements.paymentNotes.value, 170), 20, 168);
    }

    // Total Section
    doc.setFillColor(245, 245, 245);
    doc.rect(130, 200, 60, 15, 'F');
    doc.setTextColor(...primaryColor);
    doc.setFontSize(14);
    doc.text(`TOTAL PAID: ₹ ${amount}`, 135, 210);

    // Signature Area
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(10);
    doc.text('Librarian Authorization', 150, 240);
    doc.line(140, 255, 190, 255);
    doc.text(elements.adminName.textContent, 150, 262);

    // Footer
    doc.setFontSize(10);
    doc.setTextColor(150, 150, 150);
    doc.text('Thank you for your timely settlement.', 105, 280, { align: 'center' });
    doc.text('Computer generated receipt. No physical signature required for standard audits.', 105, 285, { align: 'center' });

    // Download
    doc.save(`Receipt_${selectedStudent.ad_no}_${receiptNo}.pdf`);
}
