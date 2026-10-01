<?php
session_start();
require '../config.php';
require '../vendor/autoload.php';
require '../helpers/label_parser.php';

use Picqer\Barcode\BarcodeGeneratorPNG;

// Get all 9 parameters from POST (in MM)
$topMargin = (float)($_POST['top_margin_mm'] ?? 12.0);
$sideMargin = (float)($_POST['side_margin_mm'] ?? 5.0);
$verticalPitch = (float)($_POST['vertical_pitch_mm'] ?? 21.0);
$horizontalPitch = (float)($_POST['horizontal_pitch_mm'] ?? 40.0);
$labelHeight = (float)($_POST['label_height_mm'] ?? 21.0);
$labelWidth = (float)($_POST['label_width_mm'] ?? 38.0);
$columns = (int)($_POST['columns'] ?? 5);
$rows = (int)($_POST['rows'] ?? 13);
$pageSize = $_POST['page_size'] ?? 'A4';
$barcodeScale = (int)($_POST['barcode_scale'] ?? 2);

// Get books, options, and label preset
$selectedBooks = $_POST['books'] ?? [];
$options = $_POST['options'] ?? [];
$printFields = $_POST['print_fields'] ?? ['library', 'call_number', 'accession'];
$callNumberPrefix = trim($_POST['call_number_prefix'] ?? '');
$labelPreset = (int)($_POST['label_preset'] ?? 1);

// Get font sizes from POST (or use defaults in PT)
$fontLibrary = (float)($_POST['font_library'] ?? 11);
$fontCallNumber = (float)($_POST['font_call_number'] ?? 10);
$fontTitle = (float)($_POST['font_title'] ?? 9);
$fontAuthor = (float)($_POST['font_author'] ?? 8);
$fontIsbn = (float)($_POST['font_isbn'] ?? 7);
$fontPublisher = (float)($_POST['font_publisher'] ?? 7);
$fontAccession = (float)($_POST['font_accession'] ?? 12);

// Validate input
if (empty($selectedBooks)) {
    die("<div style='text-align:center;color:white;font-family:Inter;background:#0f1724;padding:50px;'><p style='color:#ef4444;font-weight:600;'>❌ No books selected for printing.</p></div>");
}

// Validate all dimensions
if ($labelWidth <= 0 || $labelHeight <= 0 || $columns <= 0 || $rows <= 0) {
    die("<div style='text-align:center;color:white;font-family:Inter;background:#0f1724;padding:50px;'><p style='color:#ef4444;font-weight:600;'>❌ Invalid label dimensions.</p></div>");
}

// Paper sizes in MM
$paperSizes = [
    'A4' => ['width' => 210, 'height' => 297],
    'A3' => ['width' => 297, 'height' => 420],
    'A5' => ['width' => 148, 'height' => 210],
    'A2' => ['width' => 420, 'height' => 594],
    'Letter' => ['width' => 216, 'height' => 279],
    'Legal' => ['width' => 216, 'height' => 356]
];

if (!isset($paperSizes[$pageSize])) {
    $pageSize = 'A4';
}

$paperWidth = $paperSizes[$pageSize]['width'];
$paperHeight = $paperSizes[$pageSize]['height'];

// Convert MM to CM for CSS (1 MM = 0.1 CM)
$topMarginCm = $topMargin / 10;
$sideMarginCm = $sideMargin / 10;
$labelWidthCm = $labelWidth / 10;
$labelHeightCm = $labelHeight / 10;
$paperWidthCm = $paperWidth / 10;
$paperHeightCm = $paperHeight / 10;

// Calculate grid container dimensions in CM
// Grid height: top margin + (label height × rows) + (gap × (rows - 1))
// where gap = pitch - label_height (since pitch is center-to-center distance)
$gapVerticalMm = $verticalPitch - $labelHeight;
$gapHorizontalMm = $horizontalPitch - $labelWidth;
$gapVerticalCm = $gapVerticalMm / 10;
$gapHorizontalCm = $gapHorizontalMm / 10;
$gridHeightMm = $topMargin + ($labelHeight * $rows) + ($gapVerticalMm * ($rows - 1));
$gridHeightCm = $gridHeightMm / 10;
// Grid width: (label width × columns) + (gap × (columns - 1))
$gridWidthMm = ($labelWidth * $columns) + ($gapHorizontalMm * ($columns - 1));
$gridWidthCm = $gridWidthMm / 10;

// Validate configuration fits
$totalWidth = ($sideMargin * 2) + ($labelWidth * $columns) + (($horizontalPitch - $labelWidth) * ($columns - 1));
$totalHeight = $topMargin + ($labelHeight * $rows) + (($verticalPitch - $labelHeight) * ($rows - 1));

if ($totalWidth > $paperWidth || $totalHeight > $paperHeight) {
    die("<div style='text-align:center;color:white;font-family:Inter;background:#0f1724;padding:50px;'>" .
        "<div style='background:#fee2e2;color:#b91c1c;padding:20px;border-radius:10px;max-width:500px;margin:auto;'>" .
        "<p style='font-weight:600;'>❌ Configuration exceeds paper size!</p>" .
        "<p>Required: " . number_format($totalWidth, 1) . "mm × " . number_format($totalHeight, 1) . "mm</p>" .
        "<p>Paper: " . $pageSize . " (" . $paperWidth . "×" . $paperHeight . "mm)</p>" .
        "</div></div>");
}

// Fetch book data (ordered by accession number for sequential printing)
$placeholders = str_repeat('?,', count($selectedBooks) - 1) . '?';
$stmt = $pdo->prepare("SELECT * FROM books WHERE id IN ($placeholders) ORDER BY CAST(accession_number AS UNSIGNED) ASC, accession_number ASC");
$stmt->execute($selectedBooks);
$books = $stmt->fetchAll(PDO::FETCH_ASSOC);

// Fetch library name
$stmt = $pdo->query("SELECT setting_value FROM system_settings WHERE setting_key = 'library_name'");
$result = $stmt->fetch(PDO::FETCH_ASSOC);
$libraryName = $result['setting_value'] ?? "AL MARAKISH LIBRARY";

// Initialize barcode generator
$generator = new BarcodeGeneratorPNG();

// Function to parse call number into multiple lines
function parseCallNumber($callNumber, $prefix = '', $numLines = 3) {
    if (empty($callNumber)) {
        return [];
    }
    
    // Split by spaces
    $parts = preg_split('/\s+/', trim($callNumber));
    $lines = [];
    
    // Limit to $numLines parts
    for ($i = 0; $i < min($numLines, count($parts)); $i++) {
        if ($i === 0 && !empty($prefix)) {
            // First line gets prefix
            $lines[] = $prefix . '/' . $parts[$i];
        } else {
            $lines[] = $parts[$i];
        }
    }
    
    return $lines;
}

// Calculate pages needed - books start from FIRST label position
$labelsPerPage = $columns * $rows;
$totalBooks = count($books);
$totalPages = ceil($totalBooks / $labelsPerPage);

// Create array of all labels - tightly packed from position 0
// No offset/padding before first book - labels start immediately
$allLabels = array_merge(
    $books,  // Actual books starting from first label slot
    array_fill(0, ($totalPages * $labelsPerPage) - $totalBooks, null)  // Empty labels to complete last page
);
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>🖨️ Print Labels - AL MARAKISH LIBRARY</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

:root {
  --primary: #9c4dff;
  --bg-dashboard: #0f1724;
  --card-bg: #1e293b;
}

body {
  background: var(--bg-dashboard);
  color: white;
  font-family: 'Inter', sans-serif;
  display: flex;
  min-height: 100vh;
}

/* Main Content */
.main-content {
  flex: 1;
  margin-left: var(--sb-width, 240px);
  padding: 20px;
}

.app-sidebar.collapsed ~ .main-content {
  margin-left: 72px;
}

/* Header */
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--card-bg);
  padding: 16px 24px;
  border-radius: 14px;
  margin-bottom: 20px;
  box-shadow: 0 4px 10px rgba(0,0,0,0.15);
}

.header h1 {
  font-size: 22px;
  font-weight: 700;
  background: linear-gradient(90deg, var(--primary), #f59e0b);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.header button {
  background: var(--primary);
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 10px;
  font-weight: 600;
  cursor: pointer;
  transition: 0.2s;
}

.header button:hover {
  background: #6a11cb;
}

/* Info Box */
.print-info {
  background: var(--card-bg);
  padding: 14px 20px;
  border-radius: 10px;
  margin-bottom: 20px;
  font-size: 12px;
  color: #cbd5e1;
  border-left: 4px solid var(--primary);
}

/* Page Break */
.page-break {
  page-break-after: always;
  margin-bottom: 20px;
  position: relative;
  display: flex;
  justify-content: center;
}

/* A4 Paper Container with Dotted Border */
.paper-container {
  width: <?= $paperWidthCm ?>cm;
  height: <?= $paperHeightCm ?>cm;
  background: white;
  border: 2px dotted rgba(156, 77, 255, 0.4);
  border-radius: 2mm;
  position: relative;
  box-shadow: 0 0 0 1px rgba(156, 77, 255, 0.2);
}

/* Label Container - Positioned using all 9 parameters */
.labels-container {
  position: absolute;
  top: <?= $topMarginCm ?>cm;
  left: <?= $sideMarginCm ?>cm;
  width: <?= $gridWidthCm ?>cm;
  height: <?= ($gridHeightCm - $topMarginCm) ?>cm;
  display: grid;
  grid-template-columns: repeat(<?= $columns ?>, <?= $labelWidthCm ?>cm);
  grid-template-rows: repeat(<?= $rows ?>, <?= $labelHeightCm ?>cm);
  gap: 0;
  box-sizing: border-box;
  
  row-gap: <?= $gapVerticalCm ?>cm;
  column-gap: <?= $gapHorizontalCm ?>cm;
}

/* Individual Label */
.label {
  background: white;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  overflow: hidden;
  color: #000;
  /* font-size controlled by inline styles on individual elements */
  line-height: 1.1;
  text-align: center;
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: 5px;
  box-sizing: border-box;
  padding: 0.8mm;
  margin: 0;
}

.label-empty {
  background: #f5f5f5;
  border: 1px dashed #ccc;
}

.label-content {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 0.6mm;
  overflow: visible;
  padding: 0.5mm;
}

.label-library {
  /* font-size controlled by inline style */
  font-weight: bold;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  overflow: visible;
  text-overflow: clip;
  white-space: normal;
  max-width: 100%;
  color: #000;
  line-height: 1.2;
  word-wrap: break-word;
}

.label-title {
  /* font-size controlled by inline style */
  font-weight: 600;
  overflow: visible;
  text-overflow: clip;
  display: block;
  max-width: 100%;
  color: #000;
  line-height: 1.3;
  word-wrap: break-word;
}

.label-barcode {
  margin: 0.8mm 0;
  max-width: 95%;
  max-height: 8mm;
  min-height: 5mm;
  display: flex;
  justify-content: center;
  align-items: center;
  overflow: visible;
}

.label-barcode img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  display: block;
}

.label-booknumber {
  /* font-size controlled by inline style */
  font-weight: bold;
  font-family: 'Courier New', monospace;
  overflow: visible;
  text-overflow: clip;
  white-space: normal;
  color: #000;
  line-height: 1.2;
}

.label-isbn, .label-author, .label-call, .label-publisher {
  /* font-size controlled by inline style */
  overflow: visible;
  text-overflow: clip;
  white-space: normal;
  max-width: 100%;
  color: #000;
  line-height: 1.2;
  word-wrap: break-word;
}

/* Preview Styles - Normal Display (Browser) */
@media screen {
  .paper-container {
    margin: 10px auto;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
  }
  
  .label {
    background: white;
    color: #000;
  }
  
  .label-content {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    width: 100%;
    height: 100%;
  }
  
  .label-library {
    display: block;
    width: 100%;
    text-align: center;
    color: #000;
    /* font-size controlled by inline style */
    font-weight: bold;
  }
  
  .label-title {
    display: block;
    width: 100%;
    text-align: center;
    color: #000;
    /* font-size controlled by inline style */
    font-weight: 600;
  }
  
  .label-booknumber {
    display: block;
    width: 100%;
    text-align: center;
    color: #000;
    /* font-size controlled by inline style */
    font-weight: bold;
  }
  
  .label-barcode {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100%;
  }
  
  .label-isbn, .label-author, .label-call, .label-publisher {
    display: block;
    width: 100%;
    text-align: center;
    color: #333;
    /* font-size controlled by inline style */
  }
}

/* Print Styles */
@media print {
  * {
    margin: 0 !important;
    padding: 0 !important;
  }

  body {
    background: white;
    color: #000;
    display: block;
    margin: 0;
    padding: 0;
    width: 100%;
    height: 100%;
  }
  
  .app-sidebar, .header, .print-info {
    display: none !important;
  }
  
  .main-content {
    margin: 0 !important;
    padding: 0 !important;
    background: white;
    width: 100%;
    height: 100%;
    display: block;
  }
  
  .page-break {
    page-break-after: always;
    margin: 0 !important;
    padding: 0 !important;
    display: block;
    width: <?= $paperWidthCm ?>cm;
    height: <?= $paperHeightCm ?>cm;
    page-break-inside: avoid;
  }
  
  .paper-container {
    border: none !important;
    margin: 0 !important;
    padding: 0 !important;
    box-shadow: none !important;
    page-break-inside: avoid !important;
    width: <?= $paperWidthCm ?>cm !important;
    height: <?= $paperHeightCm ?>cm !important;
    display: block !important;
    position: relative !important;
    background: white !important;
  }
  
  .labels-container {
    position: absolute !important;
    top: <?= $topMarginCm ?>cm !important;
    left: <?= $sideMarginCm ?>cm !important;
    width: <?= $gridWidthCm ?>cm !important;
    height: <?= ($gridHeightCm - $topMarginCm) ?>cm !important;
    display: grid !important;
    grid-template-columns: repeat(<?= $columns ?>, <?= $labelWidthCm ?>cm) !important;
    grid-template-rows: repeat(<?= $rows ?>, <?= $labelHeightCm ?>cm) !important;
    row-gap: <?= $gapVerticalCm ?>cm !important;
    column-gap: <?= $gapHorizontalCm ?>cm !important;
    margin: 0 !important;
    padding: 0 !important;
  }
  
  .label {
    background: white !important;
    color: #000 !important;
    margin: 0 !important;
    padding: 0.8mm !important;
    width: 100% !important;
    height: 100% !important;
    display: flex !important;
    flex-direction: column !important;
    justify-content: center !important;
    align-items: center !important;
    overflow: hidden !important;
    box-sizing: border-box !important;
    page-break-inside: avoid !important;
  }
  
  .label-empty {
    background: white !important;
    border: 0.5pt solid #ddd !important;
  }
  
  .label-content {
    width: 100% !important;
    height: 100% !important;
    display: flex !important;
    flex-direction: column !important;
    justify-content: center !important;
    align-items: center !important;
    gap: 0.6mm !important;
    overflow: visible !important;
    padding: 0.5mm !important;
  }
  
  .label-library {
    display: block !important;
    width: 100% !important;
    text-align: center !important;
    color: #000 !important;
    /* font-size controlled by inline style - DO NOT override with !important */
    font-weight: bold !important;
    overflow: visible !important;
    line-height: 1.2 !important;
  }
  
  .label-title {
    display: block !important;
    width: 100% !important;
    text-align: center !important;
    color: #000 !important;
    /* font-size controlled by inline style - DO NOT override with !important */
    font-weight: 600 !important;
    overflow: visible !important;
    line-height: 1.3 !important;
  }
  
  .label-booknumber {
    display: block !important;
    width: 100% !important;
    text-align: center !important;
    color: #000 !important;
    /* font-size controlled by inline style - DO NOT override with !important */
    font-weight: bold !important;
    overflow: visible !important;
    line-height: 1.2 !important;
  }
  
  .label-barcode {
    display: flex !important;
    justify-content: center !important;
    align-items: center !important;
    width: 100% !important;
    max-width: 95% !important;
    max-height: 8mm !important;
    min-height: 5mm !important;
    margin: 0.8mm 0 !important;
    overflow: visible !important;
  }
  
  .label-barcode img {
    max-width: 100% !important;
    max-height: 100% !important;
    object-fit: contain !important;
    display: block !important;
  }
  
  .label-isbn, .label-author, .label-call, .label-publisher {
    display: block !important;
    width: 100% !important;
    text-align: center !important;
    color: #000 !important;
    /* font-size controlled by inline style - DO NOT override with !important */
    overflow: visible !important;
    line-height: 1.2 !important;
  }
}

@media (max-width: 768px) {
  .main-content {
    margin-left: 0 !important;
    padding: 5px !important;
  }
  
  .header {
    flex-direction: column;
    gap: 10px;
  }
  
  .page-break {
    display: flex;
    justify-content: center;
    align-items: flex-start;
  }
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
  <div class="header">
    <h1>📦 Print Book Labels</h1>
    <button onclick="window.print()"><i class="fa fa-print"></i> Print</button>
  </div>

  <div class="print-info">
    📊 <strong>Configuration:</strong> 
    <?= number_format($labelWidth, 1) ?>×<?= number_format($labelHeight, 1) ?>mm labels |
    Grid: <?= $columns ?>×<?= $rows ?> (<?= ($columns * $rows) ?>/page) |
    Paper: <?= $pageSize ?> |
    Books: <?= $totalBooks ?> |
    Pages: <?= $totalPages ?> |
    Top: <?= number_format($topMargin, 1) ?>mm, Side: <?= number_format($sideMargin, 1) ?>mm, 
    Pitch: <?= number_format($horizontalPitch, 1) ?>×<?= number_format($verticalPitch, 1) ?>mm
  </div>

  <?php
    // Render all pages
    for ($page = 0; $page < $totalPages; $page++) {
        $startIdx = $page * $labelsPerPage;
  ?>
  <div class="page-break">
    <div class="paper-container">
      <div class="labels-container">
      <?php
        // Render all label slots on this page
        for ($slot = 0; $slot < $labelsPerPage; $slot++) {
            $labelIdx = $startIdx + $slot;
            $book = ($labelIdx < count($allLabels)) ? $allLabels[$labelIdx] : null;
            
            if ($book === null) {
                // Empty slot
                echo '<div class="label label-empty"></div>';
            } else {
      ?>
      <div class="label">
        <div class="label-content">
          <?php 
            // FIELD-BASED RENDERING (based on print_fields selection)
            if (!empty($printFields)) {
                // User selected specific fields - render them
                $fieldCount = 0;
                
                if (in_array('library', $printFields)) {
                    echo "<div class=\"label-library\" style=\"font-size:{$fontLibrary}pt;font-weight:bold;text-align:center;\">" .
                         htmlspecialchars($libraryName) . "</div>";
                    $fieldCount++;
                }
                
                if (in_array('call_number', $printFields) && !empty($book['call_number'])) {
                    $callNumberLines = parseCallNumber($book['call_number'], $callNumberPrefix, 3);
                    foreach ($callNumberLines as $line) {
                        echo "<div class=\"label-call-number\" style=\"font-size:{$fontCallNumber}pt;font-weight:600;text-align:center;\">" .
                             htmlspecialchars($line) . "</div>";
                    }
                    $fieldCount++;
                }
                
                if (in_array('title', $printFields) && !empty($book['title'])) {
                    echo "<div class=\"label-title\" style=\"font-size:{$fontTitle}pt;font-weight:600;text-align:center;\">" .
                         htmlspecialchars(substr($book['title'], 0, 45)) . "</div>";
                    $fieldCount++;
                }
                
                if (in_array('author', $printFields) && !empty($book['author'])) {
                    echo "<div class=\"label-author\" style=\"font-size:{$fontAuthor}pt;font-style:italic;text-align:center;\">" .
                         htmlspecialchars(substr($book['author'], 0, 40)) . "</div>";
                    $fieldCount++;
                }
                
                if (in_array('barcode', $printFields) && !empty($book['book_number'] ?? $book['accession_number'] ?? '')) {
                    try {
                        $barcodeValue = $book['book_number'] ?? $book['accession_number'] ?? '';
                        $barcodeData = $generator->getBarcode(
                            $barcodeValue,
                            $generator::TYPE_CODE_128,
                            (float)$barcodeScale,
                            40
                        );
                        $barcodeBase64 = base64_encode($barcodeData);
                        echo '<div class="label-barcode" style="margin:0.6mm 0;display:flex;justify-content:center;align-items:center;">' .
                             '<img src="data:image/png;base64,' . $barcodeBase64 . '" alt="Barcode" style="max-height:6mm;max-width:90%;">' .
                             '</div>';
                    } catch (Exception $e) {
                        // Silent fail for barcode
                    }
                    $fieldCount++;
                }
                
                if (in_array('accession', $printFields)) {
                    echo "<div class=\"label-accno\" style=\"font-size:{$fontAccession}pt;font-weight:bold;text-align:center;\">" .
                         htmlspecialchars($book['book_number'] ?? $book['accession_number'] ?? '') . "</div>";
                    $fieldCount++;
                }
                
                if (in_array('isbn', $printFields) && !empty($book['isbn'])) {
                    echo "<div class=\"label-isbn\" style=\"font-size:{$fontIsbn}pt;font-family:Courier New;text-align:center;\">" .
                         htmlspecialchars($book['isbn']) . "</div>";
                    $fieldCount++;
                }
                
                if (in_array('publisher', $printFields) && !empty($book['publisher'])) {
                    echo "<div class=\"label-publisher\" style=\"font-size:{$fontPublisher}pt;text-align:center;\">" .
                         htmlspecialchars(substr($book['publisher'], 0, 40)) . "</div>";
                    $fieldCount++;
                }
            } else {
                // PRESET-BASED RENDERING (fallback if no print_fields selected)
                if ($labelPreset === 2 || $labelPreset === 5) {
                    // Presets 2 & 5 need parsed call number data
                    $parsedCallNo = parseCallNumber($book['call_number'] ?? '');
                    // Display prefix/language
                    $prefixLang = !empty($parsedCallNo['prefix']) 
                        ? $parsedCallNo['prefix'] . '/' . $parsedCallNo['language']
                        : $parsedCallNo['language'];
                        
                    echo "<div class=\"label-prefix-lang\" style=\"font-size:{$fontCallNumber}pt;font-weight:bold;text-align:center;\">" . 
                         htmlspecialchars($prefixLang) . "</div>";
                    
                    // Display classification
                    if (!empty($parsedCallNo['classification'])) {
                        echo "<div class=\"label-classification\" style=\"font-size:{$fontCallNumber}pt;font-weight:600;text-align:center;\">" .
                             htmlspecialchars($parsedCallNo['classification']) . "</div>";
                    }
                    
                    // Display author code
                    if (!empty($parsedCallNo['author_code'])) {
                        echo "<div class=\"label-author-code\" style=\"font-size:{$fontAuthor}pt;font-weight:600;text-align:center;\">" .
                             htmlspecialchars($parsedCallNo['author_code']) . "</div>";
                    }
                    
                    // For preset 5, add title
                    if ($labelPreset === 5 && !empty($book['title'])) {
                        echo "<div class=\"label-title\" style=\"font-size:{$fontTitle}pt;text-align:center;\">" . 
                             htmlspecialchars(substr($book['title'], 0, 50)) . "</div>";
                    }
                } elseif ($labelPreset === 3) {
                    // Advanced Full: Library/Language • Call No • Author | Title • ACC NO
                    echo "<div class=\"label-lib-lang\" style=\"font-size:{$fontLibrary}pt;font-weight:bold;text-align:center;\">" .
                         htmlspecialchars($libraryName) . ' / ' . htmlspecialchars($book['language'] ?? 'English') . "</div>";
                    
                    if (!empty($book['call_number'])) {
                        echo "<div class=\"label-full-callno\" style=\"font-size:{$fontCallNumber}pt;font-weight:600;text-align:center;\">" .
                             htmlspecialchars($book['call_number']) . "</div>";
                    }
                    
                    echo "<div class=\"label-author-title\" style=\"font-size:{$fontAuthor}pt;text-align:center;\">" .
                         htmlspecialchars(substr($book['author'] ?? 'Unknown', 0, 25)) . ' | ' .
                         htmlspecialchars(substr($book['title'] ?? '', 0, 35)) . "</div>";
                } elseif ($labelPreset === 4) {
                    // ISBN & Publisher: Library • Title • Author • ISBN | Publisher • ACC NO
                    echo "<div class=\"label-library\" style=\"font-size:{$fontLibrary}pt;font-weight:bold;text-align:center;\">" .
                         htmlspecialchars($libraryName) . "</div>";
                    
                    if (!empty($book['title'])) {
                        echo "<div class=\"label-title\" style=\"font-size:{$fontTitle}pt;font-weight:600;text-align:center;\">" .
                             htmlspecialchars(substr($book['title'], 0, 45)) . "</div>";
                    }
                    
                    if (!empty($book['author'])) {
                        echo "<div class=\"label-author\" style=\"font-size:{$fontAuthor}pt;text-align:center;\">" .
                             htmlspecialchars(substr($book['author'], 0, 40)) . "</div>";
                    }
                    
                    echo "<div class=\"label-isbn-pub\" style=\"font-size:{$fontIsbn}pt;text-align:center;\">" .
                         'ISBN: ' . htmlspecialchars($book['isbn'] ?? 'N/A') . ' | ' .
                         htmlspecialchars(substr($book['publisher'] ?? '', 0, 25)) . "</div>";
                } else {
                    // DEFAULT: Preset 1 (Simple Library)
                    echo "<div class=\"label-library\" style=\"font-size:{$fontLibrary}pt;font-weight:bold;text-align:center;\">" .
                         htmlspecialchars($libraryName) . "</div>";
                    
                    // Generate barcode
                    if (!empty($book['book_number'] ?? $book['accession_number'] ?? '')) {
                        try {
                            $barcodeValue = $book['book_number'] ?? $book['accession_number'] ?? '';
                            $barcodeData = $generator->getBarcode(
                                $barcodeValue,
                                $generator::TYPE_CODE_128,
                                (float)$barcodeScale,
                                40
                            );
                            $barcodeBase64 = base64_encode($barcodeData);
                            echo '<div class="label-barcode" style="margin:0.6mm 0;display:flex;justify-content:center;align-items:center;">' .
                                 '<img src="data:image/png;base64,' . $barcodeBase64 . '" alt="Barcode" style="max-height:6mm;max-width:90%;">' .
                                 '</div>';
                        } catch (Exception $e) {
                            echo '<div class="label-barcode-text" style="font-size:1.4mm;text-align:center;">Automatic From ACC NO</div>';
                        }
                    }
                    
                    // ACC NO
                    echo "<div class=\"label-accno\" style=\"font-size:{$fontAccession}pt;font-weight:bold;text-align:center;\">" .
                         htmlspecialchars($book['book_number'] ?? $book['accession_number'] ?? '') . "</div>";
                }
            }
          ?>
        </div>
      </div>
      <?php
            }
        }
      ?>
      </div>
    </div>
  </div>
  <?php } ?>

</div>

</body>
</html>
