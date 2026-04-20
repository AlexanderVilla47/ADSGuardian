$apiKey = "__REDACTED_N8N_API_KEY__"

$headers = @{"Content-Type" = "application/json"; "X-N8N-API-KEY" = $apiKey}

# Import endpoint
$body = Get-Content "workflows/contract-ui-management-v2-search-ready.json" -Raw

Write-Host "Importing..."
try {
    $r = Invoke-RestMethod -Uri "http://168.138.125.21:5678/api/v1/workflows/import" -Method POST -Headers $headers -Body $body -TimeoutSec 60
    Write-Host "SUCCESS! Imported: $($r.name)"
} catch {
    Write-Host "ERROR: $($_.Exception.Message)"
}