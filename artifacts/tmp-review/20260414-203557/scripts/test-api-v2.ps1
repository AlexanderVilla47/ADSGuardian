$apiKey = "__REDACTED_N8N_API_KEY__"

$headers = @{"Content-Type" = "application/json"
          "X-N8N-API-KEY" = $apiKey}

# Test simple GET
Write-Host "Testing GET /api/v1/workflows..."
try {
    $r = Invoke-RestMethod -Uri "http://168.138.125.21:5678/api/v1/workflows?limit=1" -Method GET -Headers $headers -TimeoutSec 30
    Write-Host "SUCCESS! Found $($r.total) workflows"
} catch {
    Write-Host "ERROR: $($_.Exception.Message)"
}