$headers = @{
    "Content-Type" = "application/json"
    "X-N8N-API-KEY" = $env:N8N_MCP_TOKEN
}
try {
    $r = Invoke-RestMethod -Uri "http://168.138.125.21.nip.io:5678/api/v1/workflows?limit=1" -Method GET -Headers $headers -TimeoutSec 30
    Write-Host "AUTH OK - Found workflows"
    $r | ConvertTo-Json -Depth 2
} catch {
    Write-Host "ERROR: $_"
}