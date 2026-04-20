$apiKey = "__REDACTED_N8N_API_KEY__"

$body = Get-Content "workflows/contract-ui-management-v2-search-ready.json" -Raw -Encoding UTF8

$headers = @{
    "Content-Type" = "application/json"
    "X-N8N-API-KEY" = $apiKey
}

Write-Host "Uploading workflow..."
$r = Invoke-RestMethod -Uri "http://168.138.125.21:5678/api/v1/workflows/cFBr6GavlSWDsUFz" -Method PUT -Headers $headers -Body $body -TimeoutSec 60

Write-Host "SUCCESS: $($r.name)"