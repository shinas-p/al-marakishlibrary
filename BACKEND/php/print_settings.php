<?php
session_start();
require '../config.php';

// Handle settings save
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['save_print_settings'])) {
    try {
        // Table already exists from migration, no need to create
        
        $settings = [
            'print_page_size' => $_POST['page_size'] ?? 'A4',
            'print_label_width' => (float)($_POST['label_width'] ?? 38),
            'print_label_height' => (float)($_POST['label_height'] ?? 21),
            'print_horizontal_pitch' => (float)($_POST['horizontal_pitch'] ?? 40),
            'print_vertical_pitch' => (float)($_POST['vertical_pitch'] ?? 21),
            'print_number_across' => (int)($_POST['number_across'] ?? 5),
            'print_number_down' => (int)($_POST['number_down'] ?? 13),
            'print_top_margin' => (float)($_POST['top_margin'] ?? 12),
            'print_side_margin' => (float)($_POST['side_margin'] ?? 5),
            'print_font_library' => (int)($_POST['font_library'] ?? 7),
            'print_font_title' => (int)($_POST['font_title'] ?? 6),
            'print_font_author' => (int)($_POST['font_author'] ?? 5),
            'print_font_isbn' => (int)($_POST['font_isbn'] ?? 5),
            'print_font_call_number' => (int)($_POST['font_call_number'] ?? 6),
            'print_font_publisher' => (int)($_POST['font_publisher'] ?? 5),
            'print_font_accession' => (int)($_POST['font_accession'] ?? 8),
            'print_barcode_height' => (int)($_POST['barcode_height'] ?? 20),
            'print_barcode_scale' => (int)($_POST['barcode_scale'] ?? 2),
            'print_call_number_lines' => (int)($_POST['call_number_lines'] ?? 3),
            'print_offset_top' => (float)($_POST['offset_top'] ?? 0),
            'print_offset_left' => (float)($_POST['offset_left'] ?? 0),
        ];
        
        $stmt = $pdo->prepare("INSERT INTO system_settings (setting_key, setting_value, category) VALUES (?, ?, 'labels') 
                               ON DUPLICATE KEY UPDATE setting_value = ?, updated_at = CURRENT_TIMESTAMP");
        
        foreach ($settings as $key => $value) {
            $stmt->execute([$key, $value, $value]);
        }
        
        $success = "✅ Print settings saved successfully!";
    } catch (Exception $e) {
        $error = "❌ Error: " . $e->getMessage();
    }
}

// Load current settings
try {
    $stmt = $pdo->query("SELECT setting_key, setting_value FROM system_settings WHERE setting_key LIKE 'print_%'");
    $settingsData = $stmt->fetchAll(PDO::FETCH_KEY_PAIR);
} catch (Exception $e) {
    $settingsData = [];
}

// Default values
$defaults = [
    'print_page_size' => 'A4',
    'print_label_width' => 38,
    'print_label_height' => 21,
    'print_horizontal_pitch' => 40,
    'print_vertical_pitch' => 21,
    'print_number_across' => 5,
    'print_number_down' => 13,
    'print_top_margin' => 12,
    'print_side_margin' => 5,
    'print_font_library' => 7,
    'print_font_title' => 6,
    'print_font_author' => 5,
    'print_font_isbn' => 5,
    'print_font_call_number' => 6,
    'print_font_publisher' => 5,
    'print_font_accession' => 8,
    'print_barcode_height' => 20,
    'print_barcode_scale' => 2,
    'print_call_number_lines' => 3,
    'print_offset_top' => 0,
    'print_offset_left' => 0,
];

$config = array_merge($defaults, $settingsData);
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Print Label Settings</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }

body {
    font-family: 'Inter', Arial, sans-serif;
    background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%);
    color: white;
    min-height: 100vh;
    padding: 20px;
}

.container {
    max-width: 900px;
    margin: 0 auto;
}

.header {
    text-align: center;
    margin-bottom: 30px;
}

.header h1 {
    font-size: 32px;
    margin-bottom: 8px;
    color: #9c4dff;
}

.card {
    background: rgba(255, 255, 255, 0.08);
    backdrop-filter: blur(20px);
    border-radius: 20px;
    padding: 30px;
    margin-bottom: 20px;
    border: 1px solid rgba(156, 77, 255, 0.3);
}

.card h2 {
    font-size: 22px;
    margin-bottom: 20px;
    color: #b47eff;
}

.form-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 16px;
    margin-bottom: 20px;
}

.form-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.form-group label {
    font-size: 14px;
    font-weight: 600;
    color: #cbd5e1;
}

.form-group input,
.form-group select {
    padding: 10px;
    border-radius: 8px;
    border: 1px solid rgba(156, 77, 255, 0.3);
    background: rgba(15, 23, 36, 0.6);
    color: white;
    font-size: 14px;
}

.form-group input:focus,
.form-group select:focus {
    outline: none;
    border-color: #9c4dff;
}

.alert {
    padding: 16px 20px;
    border-radius: 12px;
    margin-bottom: 20px;
    font-weight: 600;
}

.alert-success {
    background: rgba(16, 185, 129, 0.2);
    border: 1px solid #10b981;
    color: #6ee7b7;
}

.alert-error {
    background: rgba(239, 68, 68, 0.2);
    border: 1px solid #ef4444;
    color: #fca5a5;
}

.btn {
    background: linear-gradient(135deg, #9c4dff 0%, #6a11cb 100%);
    color: white;
    padding: 14px 28px;
    border-radius: 10px;
    border: none;
    cursor: pointer;
    font-weight: 600;
    font-size: 16px;
    display: inline-flex;
    align-items: center;
    gap: 10px;
    text-decoration: none;
    transition: all 0.3s;
}

.btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(156, 77, 255, 0.4);
}

.btn-outline {
    background: transparent;
    border: 2px solid #9c4dff;
}

.action-buttons {
    display: flex;
    gap: 12px;
    justify-content: center;
    margin-top: 24px;
}
</style>

<!-- Favicon -->
<link rel="icon" type="image/x-icon" href="/favicon.ico">
<link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon-32x32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/assets/favicon-16x16.png">
<link rel="apple-touch-icon" sizes="180x180" href="/assets/apple-touch-icon.png">
</head>
<body>

<?php include 'sidebar.php'; ?>

<div class="main-content">
    <div class="container">
        <div class="header">
            <h1><i class="fas fa-cog"></i> Print Label Settings</h1>
            <p>Configure all print settings in one place</p>
        </div>
        
        <?php if (isset($success)): ?>
        <div class="alert alert-success">
            <i class="fas fa-check-circle"></i> <?= $success ?>
        </div>
        <?php endif; ?>
        
        <?php if (isset($error)): ?>
        <div class="alert alert-error">
            <i class="fas fa-exclamation-triangle"></i> <?= $error ?>
        </div>
        <?php endif; ?>
        
        <!-- LIVE PREVIEW PANEL -->
        <div class="card" style="position: sticky; top: 20px; z-index: 100;">
            <h2><i class="fas fa-eye"></i> Live Preview</h2>
            <p style="color: #94a3b8; margin-bottom: 16px;">Changes update in real-time as you adjust settings below</p>
            
            <div style="background: white; padding: 20px; border-radius: 12px; overflow-x: auto;">
                <div id="livePreview" style="margin: 0 auto; position: relative;">
                    <!-- Preview will be rendered here by JavaScript -->
                    <div class="preview-label" style="border: 2px solid #9c4dff; background: rgba(156, 77, 255, 0.05); margin: 0 auto; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; padding: 2mm; box-sizing: border-box; overflow: hidden;">
                        <div class="preview-library" style="font-weight: 700; color: #000; margin-bottom: 1mm; text-transform: uppercase;">AL MARAKISH LIBRARY</div>
                        <div class="preview-call" style="color: #000; font-weight: 600; margin-bottom: 1mm;">813.52 FIT</div>
                        <div class="preview-title" style="color: #333; margin-bottom: 1mm; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; width: 100%;">The Great Gatsby</div>
                        <div class="preview-author" style="color: #555; font-style: italic; margin-bottom: 1mm; font-size: 0.9em;">by F. Scott Fitzgerald</div>
                        <div class="preview-barcode" style="margin: 1mm 0; width: 95%; height: 15mm; background: repeating-linear-gradient(90deg, #000 0px, #000 2px, #fff 2px, #fff 4px); border-radius: 2px;"></div>
                        <div class="preview-accession" style="font-weight: 700; color: #000; font-family: 'Courier New', monospace;">ACC001234</div>
                    </div>
                </div>
                
                <div style="margin-top: 12px; padding: 12px; background: rgba(156, 77, 255, 0.1); border-radius: 8px; font-size: 13px; color: #64748b; text-align: center;">
                    <strong>Dimensions:</strong> <span id="previewDims">38mm × 21mm</span>
                </div>
            </div>
        </div>
        
        <form method="POST">
            <!-- Page Setup -->
            <div class="card">
                <h2><i class="fas fa-file"></i> Page Setup</h2>
                <div class="form-grid">
                    <div class="form-group">
                        <label>Page Size</label>
                        <select name="page_size">
                            <option value="A4" <?= $config['print_page_size'] === 'A4' ? 'selected' : '' ?>>A4 (210 × 297 mm)</option>
                            <option value="Letter" <?= $config['print_page_size'] === 'Letter' ? 'selected' : '' ?>>Letter (8.5 × 11")</option>
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label>Top Margin (mm)</label>
                        <input type="number" name="top_margin" value="<?= $config['print_top_margin'] ?>" step="0.1">
                    </div>
                    
                    <div class="form-group">
                        <label>Side Margin (mm)</label>
                        <input type="number" name="side_margin" value="<?= $config['print_side_margin'] ?>" step="0.1">
                    </div>
                </div>
            </div>
            
            <!-- Label Dimensions -->
            <div class="card">
                <h2><i class="fas fa-ruler"></i> Label Dimensions</h2>
                <div class="form-grid">
                    <div class="form-group">
                        <label>Label Width (mm)</label>
                        <input type="number" name="label_width" value="<?= $config['print_label_width'] ?>" step="0.1">
                    </div>
                    
                    <div class="form-group">
                        <label>Label Height (mm)</label>
                        <input type="number" name="label_height" value="<?= $config['print_label_height'] ?>" step="0.1">
                    </div>
                    
                    <div class="form-group">
                        <label>Horizontal Pitch (mm)</label>
                        <input type="number" name="horizontal_pitch" value="<?= $config['print_horizontal_pitch'] ?>" step="0.1">
                    </div>
                    
                    <div class="form-group">
                        <label>Vertical Pitch (mm)</label>
                        <input type="number" name="vertical_pitch" value="<?= $config['print_vertical_pitch'] ?>" step="0.1">
                    </div>
                    
                    <div class="form-group">
                        <label>Labels Across</label>
                        <input type="number" name="number_across" value="<?= $config['print_number_across'] ?>" min="1">
                    </div>
                    
                    <div class="form-group">
                        <label>Labels Down</label>
                        <input type="number" name="number_down" value="<?= $config['print_number_down'] ?>" min="1">
                    </div>
                </div>
            </div>
            
            <!-- Font Sizes (in pt for print) -->
            <div class="card">
                <h2><i class="fas fa-font"></i> Font Sizes (points)</h2>
                <div class="form-grid">
                    <div class="form-group">
                        <label>Library Name</label>
                        <input type="number" name="font_library" value="<?= $config['print_font_library'] ?>" min="4" max="16">
                    </div>
                    
                    <div class="form-group">
                        <label>Title</label>
                        <input type="number" name="font_title" value="<?= $config['print_font_title'] ?>" min="4" max="14">
                    </div>
                    
                    <div class="form-group">
                        <label>Author</label>
                        <input type="number" name="font_author" value="<?= $config['print_font_author'] ?>" min="4" max="12">
                    </div>
                    
                    <div class="form-group">
                        <label>ISBN</label>
                        <input type="number" name="font_isbn" value="<?= $config['print_font_isbn'] ?>" min="4" max="12">
                    </div>
                    
                    <div class="form-group">
                        <label>Call Number</label>
                        <input type="number" name="font_call_number" value="<?= $config['print_font_call_number'] ?>" min="4" max="14">
                    </div>
                    
                    <div class="form-group">
                        <label>Publisher</label>
                        <input type="number" name="font_publisher" value="<?= $config['print_font_publisher'] ?>" min="4" max="12">
                    </div>
                    
                    <div class="form-group">
                        <label>Accession Number</label>
                        <input type="number" name="font_accession" value="<?= $config['print_font_accession'] ?>" min="5" max="16">
                    </div>
                    
                    <div class="form-group">
                        <label>Barcode Height (pt)</label>
                        <input type="number" name="barcode_height" value="<?= $config['print_barcode_height'] ?>" min="12" max="40">
                    </div>
                    
                    <div class="form-group">
                        <label>Call Number Lines</label>
                        <input type="number" name="call_number_lines" value="<?= $config['print_call_number_lines'] ?>" min="1" max="4">
                        <small style="color: #64748b; font-size: 12px; margin-top: 4px; display: block;">How many lines to split call number (1-4)</small>
                    </div>
                </div>
                
                <div style="margin-top: 16px; padding: 14px; background: rgba(59, 130, 246, 0.1); border-radius: 10px; border-left: 4px solid #3b82f6;">
                    <strong style="color: #93c5fd; font-size: 14px;"><i class="fas fa-info-circle"></i> Multi-Line Call Number Example:</strong>
                    <div style="color: #cbd5e1; font-size: 13px; margin-top: 8px; line-height: 1.8;">
                        Call Number: <code style="background: rgba(0,0,0,0.3); padding: 2px 6px; border-radius: 4px;">E 203.22 MAR/T</code> + Prefix: <code style="background: rgba(0,0,0,0.3); padding: 2px 6px; border-radius: 4px;">AML</code><br>
                        <strong>3 Lines:</strong> Line 1: AML/E, Line 2: 203.22, Line 3: MAR/T
                    </div>
                </div>
            </div>
            
            <!-- Printer Calibration -->
            <div class="card">
                <h2><i class="fas fa-crosshairs"></i> Printer Calibration</h2>
                <p style="color: #94a3b8; margin-bottom: 16px;">Fine-tune label position if they print slightly off</p>
                <div class="form-grid">
                    <div class="form-group">
                        <label>Top Offset (mm)</label>
                        <input type="number" name="offset_top" value="<?= $config['print_offset_top'] ?>" step="0.5">
                        <small style="color: #64748b;">Positive = shift down, Negative = shift up</small>
                    </div>
                    
                    <div class="form-group">
                        <label>Left Offset (mm)</label>
                        <input type="number" name="offset_left" value="<?= $config['print_offset_left'] ?>" step="0.5">
                        <small style="color: #64748b;">Positive = shift right, Negative = shift left</small>
                    </div>
                </div>
            </div>
            
            <div class="action-buttons">
                <button type="submit" name="save_print_settings" class="btn">
                    <i class="fas fa-save"></i> Save Print Settings
                </button>
                <a href="select_labels.php" class="btn btn-outline">
                    <i class="fas fa-arrow-left"></i> Back to Label Selection
                </a>
            </div>
        </form>
    </div>
</div>

<script>
// LIVE PREVIEW - Updates in real-time as settings change
function updateLivePreview() {
    // Get all values
    const labelWidth = parseFloat(document.querySelector('input[name="label_width"]').value) || 38;
    const labelHeight = parseFloat(document.querySelector('input[name="label_height"]').value) || 21;
    const fontLibrary = parseInt(document.querySelector('input[name="font_library"]').value) || 7;
    const fontTitle = parseInt(document.querySelector('input[name="font_title"]').value) || 6;
    const fontAuthor = parseInt(document.querySelector('input[name="font_author"]').value) || 5;
    const fontCallNumber = parseInt(document.querySelector('input[name="font_call_number"]').value) || 6;
    const fontAccession = parseInt(document.querySelector('input[name="font_accession"]').value) || 8;
    const barcodeHeight = parseInt(document.querySelector('input[name="barcode_height"]').value) || 20;
    
    // Get preview elements
    const previewLabel = document.querySelector('.preview-label');
    const previewLibrary = document.querySelector('.preview-library');
    const previewCall = document.querySelector('.preview-call');
    const previewTitle = document.querySelector('.preview-title');
    const previewAuthor = document.querySelector('.preview-author');
    const previewBarcode = document.querySelector('.preview-barcode');
    const previewAccession = document.querySelector('.preview-accession');
    const previewDims = document.getElementById('previewDims');
    
    // Update label size
    previewLabel.style.width = labelWidth + 'mm';
    previewLabel.style.height = labelHeight + 'mm';
    
    // Update font sizes (convert pt to px for screen: 1pt ≈ 1.33px)
    previewLibrary.style.fontSize = (fontLibrary * 1.33) + 'px';
    previewCall.style.fontSize = (fontCallNumber * 1.33) + 'px';
    previewTitle.style.fontSize = (fontTitle * 1.33) + 'px';
    previewAuthor.style.fontSize = (fontAuthor * 1.33) + 'px';
    previewAccession.style.fontSize = (fontAccession * 1.33) + 'px';
    
    // Update barcode height
    previewBarcode.style.height = (barcodeHeight * 1.33) + 'px';
    
    // Update dimensions display
    previewDims.textContent = labelWidth + 'mm × ' + labelHeight + 'mm';
}

// Attach event listeners to all inputs
document.addEventListener('DOMContentLoaded', function() {
    // Get all number inputs in the form
    const inputs = document.querySelectorAll('input[type="number"]');
    
    inputs.forEach(input => {
        // Update on input change
        input.addEventListener('input', updateLivePreview);
        input.addEventListener('change', updateLivePreview);
    });
    
    // Initial update
    updateLivePreview();
    
    // Update every 100ms for smooth real-time effect
    setInterval(updateLivePreview, 100);
});
</script>

</body>
</html>
