<?php
session_start();
require '../config.php';
require '../vendor/autoload.php';

use Picqer\Barcode\BarcodeGeneratorSVG;

// Load print settings
try {
    $stmt = $pdo->query("SELECT setting_key, setting_value FROM system_settings WHERE setting_key LIKE 'print_%'");
    $settingsData = $stmt->fetchAll(PDO::FETCH_KEY_PAIR);
} catch (Exception $e) {
    $settingsData = [];
}

// Default settings
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
    'print_offset_top' => 0,
    'print_offset_left' => 0,
];

$config = array_merge($defaults, $settingsData);

// Apply calibration offsets
$config['print_top_margin'] = (float)$config['print_top_margin'] + (float)$config['print_offset_top'];
$config['print_side_margin'] = (float)$config['print_side_margin'] + (float)$config['print_offset_left'];

// Page dimensions
$pageSizes = [
    'A4' => ['width' => 210, 'height' => 297],
    'Letter' => ['width' => 215.9, 'height' => 279.4],
];
$pageSize = $pageSizes[$config['print_page_size']];

$generator = new BarcodeGeneratorSVG();
$libraryName = "AL MARAKISH LIBRARY";

// Sample book data for preview
$sampleBook = [
    'title' => 'The Great Gatsby',
    'author' => 'F. Scott Fitzgerald',
    'isbn' => '978-0-7432-7356-5',
'call_number' => '813.52 FIT',
    'accession_number' => 'ACC001234',
    'publisher' => 'Scribner'
];
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Label Preview</title>
<style>
/* CRITICAL: Page Setup for Exact Printing */
@page {
    size: <?= $config['print_page_size'] ?> portrait;
    margin: 0;
}

* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

html, body {
    margin: 0 !important;
    padding: 0 !important;
    width: <?= $pageSize['width'] ?>mm;
    height: <?= $pageSize['height'] ?>mm;
}

body {
    font-family: Arial, sans-serif;
    background: #f0f0f0;
    padding: 20px;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
}

.preview-info {
    background: linear-gradient(135deg, #9c4dff 0%, #6a11cb 100%);
    color: white;
    padding: 20px;
    border-radius: 12px;
    margin-bottom: 20px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}

.preview-info h2 {
    margin-bottom: 12px;
}

.preview-info p {
    margin-bottom: 8px;
    opacity: 0.9;
}

.label-sheet {
    width: <?= $pageSize['width'] ?>mm;
    height: <?= $pageSize['height'] ?>mm;
    padding: <?= $config['print_top_margin'] ?>mm <?= $config['print_side_margin'] ?>mm;
    display: grid;
    grid-template-columns: repeat(<?= $config['print_number_across'] ?>, <?= $config['print_label_width'] ?>mm);
    grid-template-rows: repeat(<?= $config['print_number_down'] ?>, <?= $config['print_label_height'] ?>mm);
    column-gap: <?= (float)$config['print_horizontal_pitch'] - (float)$config['print_label_width'] ?>mm;
    row-gap: <?= (float)$config['print_vertical_pitch'] - (float)$config['print_label_height'] ?>mm;
    background: white;
    margin: 0 auto;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.label {
    width: <?= $config['print_label_width'] ?>mm;
    height: <?= $config['print_label_height'] ?>mm;
    padding: 1mm;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    text-align: center;
    overflow: hidden;
    border: 1px dashed #ccc;
    page-break-inside: avoid;
}

.label.sample {
    background: rgba(156, 77, 255, 0.05);
    border: 2px solid #9c4dff;
}

.label-library {
    font-size: <?= $config['print_font_library'] ?>pt;
    font-weight: 700;
    color: #000;
    margin-bottom: 0.3mm;
    text-transform: uppercase;
}

.label-title {
    font-size: <?= $config['print_font_title'] ?>pt;
    color: #333;
    margin-bottom: 0.3mm;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 100%;
}

.label-author {
    font-size: <?= $config['print_font_author'] ?>pt;
    color: #555;
    font-style: italic;
    margin-bottom: 0.3mm;
}

.label-isbn {
    font-size: <?= $config['print_font_isbn'] ?>pt;
    color: #666;
    font-family: 'Courier New', monospace;
    margin-bottom: 0.3mm;
}

.label-call-number {
    font-size: <?= $config['print_font_call_number'] ?>pt;
    color: #000;
    font-weight: 600;
    margin-bottom: 0.3mm;
}

.label-barcode {
    margin: 0.5mm 0;
    width: 95%;
    display: flex;
    justify-content: center;
    align-items: center;
}

.label-barcode svg {
    width: 100% !important;
    height: <?= $config['print_barcode_height'] ?>pt !important;
    max-height: <?= $config['print_barcode_height'] ?>pt !important;
}

.label-barcode svg rect {
    shape-rendering: crispEdges;
}

.label-accession {
    font-size: <?= $config['print_font_accession'] ?>pt;
    font-weight: 700;
    color: #000;
    font-family: 'Courier New', monospace;
}

.label-publisher {
    font-size: <?= $config['print_font_publisher'] ?>pt;
    color: #666;
    margin-bottom: 0.3mm;
}

@media print {
    body {
        background: white;
        padding: 0;
    }
    
    .preview-info {
        display: none;
    }
    
    .label {
        border: none !important;
    }
}

.btn {
    background: linear-gradient(135deg, #9c4dff 0%, #6a11cb 100%);
    color: white;
    padding: 12px 24px;
    border-radius: 8px;
    border: none;
    cursor: pointer;
    font-weight: 600;
    font-size: 14px;
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    margin-right: 12px;
}

.btn: hover {
    opacity: 0.9;
}
</style>

<!-- Favicon -->
<link rel="icon" type="image/x-icon" href="/favicon.ico">
<link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon-32x32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/assets/favicon-16x16.png">
<link rel="apple-touch-icon" sizes="180x180" href="/assets/apple-touch-icon.png">
</head>
<body>

<div class="preview-info">
    <h2><i class="fas fa-eye"></i> Label Preview</h2>
    <p>📏 <strong>Page:</strong> <?= $config['print_page_size'] ?> (<?= $pageSize['width'] ?>mm × <?= $pageSize['height'] ?>mm)</p>
    <p>🏷️ <strong>Label Size:</strong> <?= $config['print_label_width'] ?>mm × <?= $config['print_label_height'] ?>mm</p>
    <p>📐 <strong>Layout:</strong> <?= $config['print_number_across'] ?> across × <?= $config['print_number_down'] ?> down = <?= (int)$config['print_number_across'] * (int)$config['print_number_down'] ?> labels per page</p>
    <p>📍 <strong>Margins:</strong> Top: <?= $config['print_top_margin'] ?>mm, Side: <?= $config['print_side_margin'] ?>mm</p>
    <div style="margin-top: 12px;">
        <button onclick="window.print()" class="btn">
            <i class="fas fa-print"></i> Print Preview
        </button>
        <a href="print_settings.php" class="btn" style="background: rgba(100, 116, 139, 0.8);">
            <i class="fas fa-arrow-left"></i> Back to Settings
        </a>
    </div>
</div>

<div class="label-sheet">
    <!-- First label with sample data (highlighted) -->
    <div class="label sample">
        <div class="label-library"><?= htmlspecialchars($libraryName) ?></div>
        <div class="label-call-number"><?= htmlspecialchars($sampleBook['call_number']) ?></div>
        <div class="label-title"><?= htmlspecialchars($sampleBook['title']) ?></div>
        <div class="label-author">by <?= htmlspecialchars($sampleBook['author']) ?></div>
        <?php 
        $barcodeSVG = $generator->getBarcode($sampleBook['accession_number'], $generator::TYPE_CODE_128, (int)$config['print_barcode_scale'], 50);
        ?>
        <div class="label-barcode"><?= $barcodeSVG ?></div>
        <div class="label-accession"><?= htmlspecialchars($sampleBook['accession_number']) ?></div>
    </div>
    
    <!-- Fill rest with empty labels for layout visualization -->
    <?php
    $totalLabels = (int)$config['print_number_across'] * (int)$config['print_number_down'];
    for ($i = 1; $i < $totalLabels; $i++):
    ?>
        <div class="label"></div>
    <?php endfor; ?>
</div>

</body>
</html>
