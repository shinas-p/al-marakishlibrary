/**
 * Excel Grid Management System
 * Handles data parsing, validation, and saving for bulk import grids.
 */

let gridType = '';
let gridData = [];
const columns = {
    books: ['accession_number', 'isbn', 'call_number', 'title', 'author', 'category', 'language', 'publisher', 'edition', 'publication_year', 'pages', 'volume', 'price', 'location', 'description', 'cover', 'e_book', 'country'],
    users: ['ad_no', 'full_name', 'date_of_birth', 'address', 'contact', 'blood_group', 'section', 'password']
};

function initGrid(type) {
    gridType = type;

    // Global Paste Listener
    document.addEventListener('paste', (e) => {
        // Only trigger if not in a focused input/textarea that is NOT part of the grid
        if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA' && !e.target.closest('[contenteditable]')) {
            handlePaste(e);
        }
    });

    // File Input Listener
    const fileInput = document.getElementById('excelFileInput');
    if (fileInput) {
        fileInput.addEventListener('change', handleFileImport);
    }

    // Add some default empty rows for "Grid" feel if first load
    if (gridData.length === 0) {
        addMultipleRows(10);
    }

    updateStats();
}

function handlePaste(e) {
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData('text');
    if (!text) return;

    // Split by lines and then by tabs (Excel format)
    const rows = text.split(/\r?\n/).filter(row => row.trim());
    const parsedRows = rows.map(row => row.split('\t'));

    addRowsToGrid(parsedRows);
}

function pasteFromExcel() {
    navigator.clipboard.readText().then(text => {
        if (!text) {
            showToast('Clipboard is empty or inaccessible', 'error');
            return;
        }
        const rows = text.split(/\r?\n/).filter(row => row.trim());
        const parsedRows = rows.map(row => row.split('\t'));
        addRowsToGrid(parsedRows);
    }).catch(err => {
        showToast('Please press Ctrl+V to paste', 'info');
    });
}

function addRowsToGrid(newRows) {
    const emptyState = document.getElementById('emptyState');

    if (newRows.length > 0 && emptyState) {
        emptyState.style.display = 'none';
    }

    newRows.forEach(rowData => {
        const rowId = 'row_' + Date.now() + Math.random().toString(36).substr(2, 5);
        const rowObj = { id: rowId, status: 'pending', data: {}, errors: [] };

        columns[gridType].forEach((col, index) => {
            let val = rowData[index] ? rowData[index].trim() : '';
            if (!val && col === 'quantity') val = '1';
            rowObj.data[col] = val;
        });

        gridData.push(rowObj);
        renderRow(rowObj);
    });

    validateGrid();
}

function renderRow(row) {
    const gridBody = document.getElementById('gridBody');
    const tr = document.createElement('tr');
    tr.id = row.id;
    tr.className = 'grid-row row-' + row.status;

    // Get current index for row number
    const rowIndex = gridData.findIndex(r => r.id === row.id) + 1;

    let html = `<td class="index-cell">${rowIndex}</td>`;
    html += `<td class="status-cell"><div class="status-icon status-pending"><i class="fas fa-ellipsis-h"></i></div></td>`;

    columns[gridType].forEach(col => {
        html += `<td contenteditable="true" data-col="${col}">${row.data[col] || ''}</td>`;
    });

    html += `<td><button class="grid-btn-icon" onclick="deleteRow('${row.id}')"><i class="fas fa-trash"></i></button></td>`;

    tr.innerHTML = html;
    gridBody.appendChild(tr);

    // Local input listener for contenteditable cells
    tr.querySelectorAll('[contenteditable="true"]').forEach(td => {
        td.addEventListener('input', (e) => {
            const col = e.target.getAttribute('data-col');
            row.data[col] = e.target.innerText.trim();
            // Reset duplicate status on manual edit
            row.isDuplicate = false;
            clearTimeout(row.validateTimer);
            row.validateTimer = setTimeout(() => validateRow(row.id), 500);
        });
    });
}

function validateRow(rowId) {
    const row = gridData.find(r => r.id === rowId);
    if (!row) return;

    let status = 'success';
    let errors = [];

    // Basic Validation
    if (gridType === 'books') {
        if (!row.data.accession_number) errors.push('Acc No required');
        if (!row.data.title) errors.push('Title required');
        if (row.data.quantity && isNaN(parseInt(row.data.quantity))) errors.push('Invalid Quantity');
    } else {
        if (!row.data.ad_no) errors.push('Ad No required');
        if (!row.data.full_name) errors.push('Name required');
        // Password is only mandatory if DOB is also missing
        if (!row.data.password && !row.data.date_of_birth) errors.push('Password or DOB required');
    }

    if (errors.length > 0) status = 'error';
    else if (row.isDuplicate) status = 'warning';

    row.status = status;
    row.errors = errors;

    const tr = document.getElementById(rowId);
    if (tr) {
        tr.className = 'grid-row row-' + status;
        const statusIcon = tr.querySelector('.status-icon');
        if (status === 'success') {
            statusIcon.className = 'status-icon status-ok';
            statusIcon.innerHTML = '<i class="fas fa-check"></i>';
            statusIcon.title = 'Ready';
        } else if (status === 'warning') {
            statusIcon.className = 'status-icon status-warning';
            statusIcon.innerHTML = '<i class="fas fa-clone"></i>';
            statusIcon.title = 'Duplicate ID in Database';
        } else {
            statusIcon.className = 'status-icon status-error';
            statusIcon.innerHTML = '<i class="fas fa-exclamation"></i>';
            statusIcon.title = errors.join(', ');
        }
    }

    updateStats();
}

function validateGrid() {
    gridData.forEach(row => validateRow(row.id));
}

function updateStats() {
    const total = gridData.length;
    const valid = gridData.filter(r => r.status === 'success').length;
    const errors = gridData.filter(r => r.status === 'error').length;
    const duplicates = gridData.filter(r => r.status === 'warning').length;

    const elTotal = document.getElementById('stat-total');
    const elValid = document.getElementById('stat-valid');
    const elErrors = document.getElementById('stat-errors');
    const elDuplicates = document.getElementById('stat-duplicates');

    if (elTotal) elTotal.innerText = total;
    if (elValid) elValid.innerText = valid;
    if (elErrors) elErrors.innerText = errors;
    if (elDuplicates) elDuplicates.innerText = duplicates;
}

function deleteRow(rowId) {
    gridData = gridData.filter(r => r.id !== rowId);
    const tr = document.getElementById(rowId);
    if (tr) tr.remove();

    if (gridData.length === 0) {
        const emptyState = document.getElementById('emptyState');
        if (emptyState) emptyState.style.display = 'block';
    }
    updateStats();
}

function filterByStatus(status) {
    const rows = document.querySelectorAll('.grid-row');
    rows.forEach(tr => {
        if (status === 'all') {
            tr.style.display = '';
        } else if (tr.classList.contains('row-' + status)) {
            tr.style.display = '';
        } else {
            tr.style.display = 'none';
        }
    });
}

async function scanDuplicates() {
    if (gridData.length === 0) return;

    showToast('Checking database for existing IDs...', 'info');

    try {
        const idField = gridType === 'books' ? 'accession_number' : 'ad_no';
        const endpoint = gridType === 'books' ? '/books' : '/admin/users';

        // Fetch existing records to check for collisions
        const response = await apiRequest(`${endpoint}?limit=10000`);
        if (!response.success) throw new Error('Database connection error');

        const existingIds = new Set();
        if (gridType === 'books') {
            (response.books || []).forEach(b => existingIds.add(b.accession_number.toString().toLowerCase()));
        } else {
            (response.users || []).forEach(u => existingIds.add(u.ad_no.toString().toLowerCase()));
        }

        gridData.forEach(row => {
            const currentId = (row.data[idField] || '').toString().toLowerCase();
            if (currentId && existingIds.has(currentId)) {
                row.isDuplicate = true;
            } else {
                row.isDuplicate = false;
            }
            validateRow(row.id);
        });

        const duplicateCount = gridData.filter(r => r.isDuplicate).length;
        if (duplicateCount > 0) {
            showToast(`Found ${duplicateCount} duplicate records in DB. Marks as orange.`, 'warning');
        } else {
            showToast('Zero database duplicates found!', 'success');
        }

    } catch (err) {
        console.error('Scan Error:', err);
        showToast('Duplicate scan failed: ' + err.message, 'error');
    }
}

async function saveToDatabase() {
    const validRows = gridData.filter(r => r.status === 'success');

    if (validRows.length === 0) {
        showToast('No valid records to save!', 'warning');
        return;
    }

    if (!confirm(`Commit ${validRows.length} records to the library database?`)) return;

    const btn = document.querySelector('.btn-preview');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
    btn.disabled = true;

    const endpoint = gridType === 'books' ? '/admin/books/add' : '/admin/users/add';
    let successCount = 0;
    let failCount = 0;

    for (const row of validRows) {
        try {
            const res = await apiRequest(endpoint, {
                method: 'POST',
                body: JSON.stringify(row.data)
            });

            if (res.success) {
                successCount++;
                row.toBeDeleted = true;
            } else {
                failCount++;
                row.status = 'error';
                row.errors = [res.error || 'Server error'];
                validateRow(row.id);
            }
        } catch (err) {
            failCount++;
            row.status = 'error';
            row.errors = [err.message];
            validateRow(row.id);
        }
    }

    // Cleanup successful rows
    gridData = gridData.filter(row => {
        if (row.toBeDeleted) {
            const tr = document.getElementById(row.id);
            if (tr) tr.remove();
            return false;
        }
        return true;
    });

    if (gridData.length === 0) {
        const emptyState = document.getElementById('emptyState');
        if (emptyState) emptyState.style.display = 'block';
    }

    updateStats();
    btn.innerHTML = originalText;
    btn.disabled = false;

    if (failCount > 0) {
        showToast(`Saved ${successCount}. ${failCount} failed. Check red rows for details.`, 'warning');
    } else {
        showToast(`Successfully imported ${successCount} records!`, 'success');
    }
}

async function handleFileImport(e) {
    const file = e.target.files[0];
    if (!file) return;

    showToast('Reading file...', 'info');

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];

            // Convert sheet to JSON array of arrays
            const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

            if (json.length < 2) {
                showToast('The file seems to be empty or missing data rows.', 'warning');
                return;
            }

            // Skip header (row 0)
            const dataRows = json.slice(1);
            addRowsToGrid(dataRows);

            showToast(`Loaded ${dataRows.length} rows from file!`, 'success');
        } catch (error) {
            console.error('File parsing error:', error);
            showToast('Failed to read Excel file: ' + error.message, 'error');
        } finally {
            // Reset input so same file can be selected again
            document.getElementById('excelFileInput').value = '';
        }
    };
    reader.readAsArrayBuffer(file);
}

// --- New Toolbar Functions ---

function addRow() {
    const emptyRow = new Array(columns[gridType].length).fill('');
    addRowsToGrid([emptyRow]);
    // Scroll to bottom
    const gridWrapper = document.querySelector('.grid-table-wrapper');
    if (gridWrapper) gridWrapper.scrollTop = gridWrapper.scrollHeight;
}

function addMultipleRows(count) {
    const rows = Array.from({ length: count }, () => new Array(columns[gridType].length).fill(''));
    addRowsToGrid(rows);
    const gridWrapper = document.querySelector('.grid-table-wrapper');
    if (gridWrapper) gridWrapper.scrollTop = gridWrapper.scrollHeight;
}

function undo() {
    showToast('Undo feature coming soon!', 'info');
}

function redo() {
    showToast('Redo feature coming soon!', 'info');
}

function clearGrid() {
    if (gridData.length === 0) return;
    if (!confirm('Clear all rows from the grid?')) return;
    gridData = [];
    const gridBody = document.getElementById('gridBody');
    if (gridBody) gridBody.innerHTML = '';
    const emptyState = document.getElementById('emptyState');
    if (emptyState) emptyState.style.display = 'block';
    updateStats();
}

function searchGrid(query) {
    const q = query.toLowerCase();
    const rows = document.querySelectorAll('.grid-row');
    rows.forEach(tr => {
        const text = tr.innerText.toLowerCase();
        tr.style.display = text.includes(q) ? '' : 'none';
    });
}

function exportFailedRows() {
    const failedRows = gridData.filter(r => r.status === 'error');
    if (failedRows.length === 0) {
        showToast('No failed rows to export', 'info');
        return;
    }

    const csvContent = "data:text/csv;charset=utf-8,"
        + columns[gridType].join(",") + "\n"
        + failedRows.map(r => columns[gridType].map(col => `"${r.data[col] || ''}"`).join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `failed_${gridType}_rows.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function downloadSample() {
    const csvContent = "data:text/csv;charset=utf-8,"
        + columns[gridType].join(",") + "\n"
        + "Example Value 1,Example Value 2,Example Value 3"; // Simple example

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `sample_${gridType}_import.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function showToast(msg, type = 'info') {
    if (window.showToast) {
        window.showToast(msg, type);
    } else {
        console.log(`Toast (${type}): ${msg}`);
        const container = document.body;
        const div = document.createElement('div');
        div.className = `message ${type} show`;
        div.style.position = 'fixed';
        div.style.bottom = '20px';
        div.style.right = '20px';
        div.style.zIndex = '10000';
        div.style.padding = '12px 24px';
        div.style.borderRadius = '8px';
        div.style.background = type === 'error' ? '#ef4444' : (type === 'success' ? '#10b981' : '#3b82f6');
        div.style.color = 'white';
        div.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
        div.innerHTML = msg;
        container.appendChild(div);
        setTimeout(() => div.remove(), 4000);
    }
}
