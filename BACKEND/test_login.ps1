# Test Admin Login API

Write-Host "`n🧪 Testing Admin Login API...`n" -ForegroundColor Cyan

# Test Case 1: Valid login with plain text password
Write-Host "Test 1: muflih / 1234 (Plain text password)" -ForegroundColor Yellow
Write-Host "Expected: ✅ SUCCESS" -ForegroundColor Green

$body = @{
    username = "muflih"
    password = "1234"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "http://localhost:5001/api/auth/admin/login" `
        -Method POST `
        -ContentType "application/json" `
        -Body $body `
        -ErrorAction Stop
    
    if ($response.success -and $response.token) {
        Write-Host "Result: ✅ SUCCESS - Login worked!" -ForegroundColor Green
        Write-Host "   Token: $($response.token.Substring(0, 20))..." -ForegroundColor Gray
        Write-Host "   User: $($response.user.full_name) ($($response.user.role))" -ForegroundColor Gray
    } else {
        Write-Host "Result: ❌ FAILED - No token received" -ForegroundColor Red
    }
} catch {
    Write-Host "Result: ❌ ERROR - $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "-----------------------------------`n" -ForegroundColor Gray

# Test Case 2: Invalid password
Write-Host "Test 2: admin / wrongpassword (Invalid password)" -ForegroundColor Yellow
Write-Host "Expected: ❌ Should fail with error" -ForegroundColor Red

$body = @{
    username = "admin"
    password = "wrongpassword"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "http://localhost:5001/api/auth/admin/login" `
        -Method POST `
        -ContentType "application/json" `
        -Body $body `
        -ErrorAction Stop
    
    Write-Host "Result: ❌ WRONG - Should have failed but succeeded!" -ForegroundColor Red
} catch {
    $errorResponse = $_.ErrorDetails.Message | ConvertFrom-Json
    Write-Host "Result: ✅ CORRECT - Failed as expected: $($errorResponse.error)" -ForegroundColor Green
}

Write-Host "-----------------------------------`n" -ForegroundColor Gray

Write-Host "✅ Testing complete!`n" -ForegroundColor Cyan
Write-Host "You can now try logging in at: http://localhost:5001/admin/login.html" -ForegroundColor Yellow
Write-Host "Use username: muflih, password: 1234`n" -ForegroundColor Yellow
