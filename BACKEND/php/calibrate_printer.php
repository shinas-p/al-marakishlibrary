<?php
session_start();
require '../config.php';

// Handle settings update
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action']) && $_POST['action'] === 'update_calibration') {
    $settings = [
        'print_offset_top' => $_POST['offset_top'] ?? 0,
        'print_offset_left' => $_POST['offset_left'] ?? 0,
        'print_top_margin' => $_POST['top_margin'] ?? 12,
        'print_side_margin' => $_POST['side_margin'] ?? 5,
        'print_bottom_margin' => $_POST['bottom_margin'] ?? 12,
    ];
    
    foreach ($settings as $key => $value) {
        $stmt = $pdo->prepare("INSERT INTO system_settings (setting_key, setting_value, category) VALUES (?, ?, 'labels') 
                               ON DUPLICATE KEY UPDATE setting_value = ?, updated_at = CURRENT_TIMESTAMP");
        $stmt->execute([$key, $value, $value]);
    }
    
    $success = "✅ Calibration settings saved successfully!";
}

// Load current settings
try {
    $stmt = $pdo->query("SELECT setting_key, setting_value FROM system_settings WHERE setting_key LIKE 'print_%'");
    $currentSettings = $stmt->fetchAll(PDO::FETCH_KEY_PAIR);
} catch (Exception $e) {
    $currentSettings = [];
}

$defaults = [
    'print_offset_top' => 0,
    'print_offset_left' => 0,
    'print_top_margin' => 12,
    'print_side_margin' => 5,
    'print_bottom_margin' => 12,
];

$settings = array_merge($defaults, $currentSettings);
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Advanced Print Calibration</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
<style>
:root {
    --primary: #9c4dff;
    --success: #10b981;
    --danger: #ef4444;
    --warning: #f59e0b;
}

* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: 'Inter', sans-serif;
    background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%);
    color: white;
    min-height: 100vh;
    padding: 32px;
}

.container {
    max-width: 1200px;
    margin: 0 auto;
}

.header {
    margin-bottom: 32px;
}

.header h1 {
    font-size: 32px;
    color: var(--primary);
    margin-bottom: 8px;
}

.header p {
    color: #94a3b8;
    font-size: 16px;
}

.alert {
    padding: 16px 20px;
    border-radius: 12px;
    margin-bottom: 24px;
    display: flex;
    align-items: center;
    gap: 12px;
    font-weight: 600;
}

.alert-success {
    background: rgba(16, 185, 129, 0.2);
    border: 1px solid rgba(16, 185, 129, 0.4);
    color: #10b981;
}

.card {
    background: rgba(255, 255, 255, 0.08);
    backdrop-filter: blur(20px);
    border-radius: 16px;
    padding: 32px;
    margin-bottom: 24px;
    border: 1px solid rgba(156, 77, 255, 0.3);
}

.card h2 {
    font-size: 24px;
    color: #b47eff;
    margin-bottom: 8px;
    display: flex;
    align-items: center;
    gap: 12px;
}

.card p {
    color: #cbd5e1;
    margin-bottom: 24px;
    line-height: 1.6;
}

.form-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 24px;
    margin-bottom: 24px;
}

.form-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.form-group label {
    font-weight: 600;
    color: #e2e8f0;
    display: flex;
    align-items: center;
    gap: 8px;
}

.form-group input {
    padding: 12px 16px;
    border-radius: 8px;
    border: 1px solid rgba(156, 77, 255, 0.3);
    background: rgba(15, 23, 36, 0.6);
    color: white;
    font-size: 16px;
    transition: all 0.3s;
}

.form-group input:focus {
    outline: none;
    border-color: var(--primary);
    box-shadow: 0 0 0 3px rgba(156, 77, 255, 0.2);
}

.form-group small {
    color: #94a3b8;
    font-size: 13px;
}

.slider-container {
    display: flex;
    align-items: center;
    gap: 16px;
}

.slider {
    flex: 1;
    height: 6px;
    border-radius: 3px;
    background: rgba(156, 77, 255, 0.2);
    outline: none;
    -webkit-appearance: none;
}

.slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: var(--primary);
    cursor: pointer;
    transition: all 0.3s;
}

.slider::-webkit-slider-thumb:hover {
    transform: scale(1.2);
    box-shadow: 0 0 0 6px rgba(156, 77, 255, 0.2);
}

.slider::-moz-range-thumb {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: var(--primary);
    cursor: pointer;
    border: none;
}

.value-display {
    min-width: 80px;
    padding: 8px 16px;
    background: rgba(156, 77, 255, 0.2);
    border-radius: 8px;
    text-align: center;
    font-weight: 700;
    color: var(--primary);
    font-size: 18px;
}

.btn {
    padding: 14px 28px;
    border-radius: 8px;
    border: none;
    cursor: pointer;
    font-weight: 600;
    font-size: 16px;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    transition: all 0.3s;
    text-decoration: none;
}

.btn-primary {
    background: linear-gradient(135deg, var(--primary) 0%, #6a11cb 100%);
    color: white;
}

.btn-primary:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(156, 77, 255, 0.4);
}

.btn-success {
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    color: white;
}

.btn-success:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(16, 185, 129, 0.4);
}

.btn-secondary {
    background: rgba(100, 116, 139, 0.8);
    color: white;
}

.btn-secondary:hover {
    background: rgba(100, 116, 139, 1);
}

.button-group {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
}

.info-box {
    background: rgba(59, 130, 246, 0.1);
    border-left: 4px solid #3b82f6;
    padding: 16px;
    border-radius: 8px;
    margin-bottom: 24px;
}

.info-box h3 {
    color: #60a5fa;
    margin-bottom: 8px;
    font-size: 18px;
}

.info-box ul {
    list-style: none;
    padding-left: 0;
}

.info-box li {
    color: #cbd5e1;
    padding: 6px 0;
    display: flex;
    align-items: center;
    gap: 8px;
}

.info-box li:before {
    content: "→";
    color: #3b82f6;
    font-weight: bold;
}

.warning-box {
    background: rgba(245, 158, 11, 0.1);
    border-left: 4px solid #f59e0b;
    padding: 16px;
    border-radius: 8px;
    margin-bottom: 24px;
}

.warning-box h3 {
    color: #fbbf24;
    margin-bottom: 8px;
    font-size: 18px;
}

.warning-box p {
    color: #cbd5e1;
    margin: 0;
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

<div class="container" style="margin-left: var(--sb-width, 240px);">
    <div class="header">
        <h1><i class="fas fa-sliders-h"></i> Advanced Print Calibration</h1>
        <p>Fine-tune your label printing for perfect alignment</p>
    </div>

    <?php if (isset($success)): ?>
    <div class="alert alert-success">
        <i class="fas fa-check-circle"></i>
        <?= $success ?>
    </div>
    <?php endif; ?>

    <div class="info-box">
        <h3><i class="fas fa-info-circle"></i> How to Calibrate</h3>
        <ul>
            <li>Print a test page using the "Test Print" button below</li>
            <li>Compare the printed labels with your actual label sheet</li>
            <li>Adjust the offsets if labels are misaligned</li>
            <li>Positive values move labels DOWN/RIGHT, negative values move UP/LEFT</li>
            <li>Save settings and test again until perfect alignment is achieved</li>
        </ul>
    </div>

    <form method="POST" action="">
        <input type="hidden" name="action" value="update_calibration">
        
        <div class="card">
            <h2><i class="fas fa-arrows-alt"></i> Margin Settings</h2>
            <p>Set the physical margins of your label sheet (distance from paper edge to first label)</p>
            
            <div class="form-grid">
                <div class="form-group">
                    <label>
                        <i class="fas fa-arrow-up"></i> Top Margin (mm)
                    </label>
                    <div class="slider-container">
                        <input type="range" name="top_margin" id="top_margin" 
                               class="slider" min="0" max="30" step="0.5" 
                               value="<?= $settings['print_top_margin'] ?>"
                               oninput="updateValue('top_margin')">
                        <span class="value-display" id="top_margin_value"><?= $settings['print_top_margin'] ?>mm</span>
                    </div>
                    <small>Distance from top edge of paper to first row of labels</small>
                </div>

                <div class="form-group">
                    <label>
                        <i class="fas fa-arrow-left"></i> Side Margin (mm)
                    </label>
                    <div class="slider-container">
                        <input type="range" name="side_margin" id="side_margin" 
                               class="slider" min="0" max="30" step="0.5" 
                               value="<?= $settings['print_side_margin'] ?>"
                               oninput="updateValue('side_margin')">
                        <span class="value-display" id="side_margin_value"><?= $settings['print_side_margin'] ?>mm</span>
                    </div>
                    <small>Distance from left edge of paper to first column</small>
                </div>

                <div class="form-group">
                    <label>
                        <i class="fas fa-arrow-down"></i> Bottom Margin (mm)
                    </label>
                    <div class="slider-container">
                        <input type="range" name="bottom_margin" id="bottom_margin" 
                               class="slider" min="0" max="30" step="0.5" 
                               value="<?= $settings['print_bottom_margin'] ?>"
                               oninput="updateValue('bottom_margin')">
                        <span class="value-display" id="bottom_margin_value"><?= $settings['print_bottom_margin'] ?>mm</span>
                    </div>
                    <small>Distance from bottom edge (prevents cut-off)</small>
                </div>
            </div>
        </div>

        <div class="card">
            <h2><i class="fas fa-crosshairs"></i> Fine-Tune Offsets</h2>
            <p>Micro-adjustments for perfect alignment (use after setting margins)</p>
            
            <div class="form-grid">
                <div class="form-group">
                    <label>
                        <i class="fas fa-arrows-alt-v"></i> Vertical Offset (mm)
                    </label>
                    <div class="slider-container">
                        <input type="range" name="offset_top" id="offset_top" 
                               class="slider" min="-10" max="10" step="0.1" 
                               value="<?= $settings['print_offset_top'] ?>"
                               oninput="updateValue('offset_top')">
                        <span class="value-display" id="offset_top_value"><?= $settings['print_offset_top'] ?>mm</span>
                    </div>
                    <small>+ moves labels DOWN, - moves labels UP</small>
                </div>

                <div class="form-group">
                    <label>
                        <i class="fas fa-arrows-alt-h"></i> Horizontal Offset (mm)
                    </label>
                    <div class="slider-container">
                        <input type="range" name="offset_left" id="offset_left" 
                               class="slider" min="-10" max="10" step="0.1" 
                               value="<?= $settings['print_offset_left'] ?>"
                               oninput="updateValue('offset_left')">
                        <span class="value-display" id="offset_left_value"><?= $settings['print_offset_left'] ?>mm</span>
                    </div>
                    <small>+ moves labels RIGHT, - moves labels LEFT</small>
                </div>
            </div>
        </div>

        <div class="warning-box">
            <h3><i class="fas fa-exclamation-triangle"></i> Important Tips</h3>
            <p>
                • Always use the same printer and paper type for consistent results<br>
                • Check your printer's "Fit to Page" or "Scale" settings - they should be at 100%<br>
                • Disable any "Shrink to Fit" or "Auto-Rotate" options in print dialog<br>
                • For best results, use high-quality label sheets with precise dimensions
            </p>
        </div>

        <div class="button-group">
            <button type="submit" class="btn btn-success">
                <i class="fas fa-save"></i> Save Calibration Settings
            </button>
            <a href="select_labels.php" class="btn btn-primary">
                <i class="fas fa-print"></i> Go to Label Printing
            </a>
            <button type="button" onclick="resetToDefaults()" class="btn btn-secondary">
                <i class="fas fa-undo"></i> Reset to Defaults
            </button>
        </div>
    </form>
</div>

<script>
function updateValue(id) {
    const input = document.getElementById(id);
    const display = document.getElementById(id + '_value');
    display.textContent = parseFloat(input.value).toFixed(1) + 'mm';
}

function resetToDefaults() {
    if (confirm('Reset all calibration settings to default values?')) {
        document.getElementById('top_margin').value = 12;
        document.getElementById('side_margin').value = 5;
        document.getElementById('bottom_margin').value = 12;
        document.getElementById('offset_top').value = 0;
        document.getElementById('offset_left').value = 0;
        
        updateValue('top_margin');
        updateValue('side_margin');
        updateValue('bottom_margin');
        updateValue('offset_top');
        updateValue('offset_left');
    }
}

// Initialize displays
window.addEventListener('load', function() {
    updateValue('top_margin');
    updateValue('side_margin');
    updateValue('bottom_margin');
    updateValue('offset_top');
    updateValue('offset_left');
});
</script>

</body>
</html>
