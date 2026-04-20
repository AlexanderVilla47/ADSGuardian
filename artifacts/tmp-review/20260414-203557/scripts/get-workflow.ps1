$headers = @{
    "Content-Type" = "application/json"
    "X-N8N-API-KEY" = "__REDACTED_N8N_API_KEY__"
}
try {
    $r = Invoke-RestMethod -Uri "http://168.138.125.21.nip.io:5678/api/v1/workflows/cFBr6GavlSWDsUFz" -Method GET -Headers $headers -TimeoutSec 30
    Write-Host "SUCCESS: Got workflow"
    $r | ConvertTo-Json -Depth 2
} catch {
    Write-Host "ERROR: $_"
}