$body = Get-Content "workflows\contract-ui-management-v2.json" -Raw -Encoding UTF8
$headers = @{
    "Content-Type" = "application/json"
    "X-N8N-API-KEY" = "__REDACTED_N8N_API_KEY__"
}
try {
    $r = Invoke-RestMethod -Uri "http://168.138.125.21.nip.io:5678/api/v1/workflows/cFBr6GavlSWDsUFz" -Method PUT -Headers $headers -Body $body -TimeoutSec 60
    Write-Host "SUCCESS: deployed"
} catch {
    Write-Host "ERROR: "$_.Exception.Response.StatusCode.Value
    $_.Exception.Message
}