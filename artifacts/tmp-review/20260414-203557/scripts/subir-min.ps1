$apiKey = "__REDACTED_N8N_API_KEY__"

$wf = Get-Content "workflows/contract-ui-management-v2-search-ready.json" -Raw | ConvertFrom-Json

# TRULY minimal - check what we successfuly pushed before
# That was only nodes + connections + settings

$payload = [ordered]@{
    nodes = $wf.nodes
    connections = $wf.connections
    settings = $wf.settings
}

$body = $payload | ConvertTo-Json -Depth 15

$headers = @{"Content-Type" = "application/json"; "X-N8N-API-KEY" = $apiKey}

Write-Host "Uploading minimal..."
$r = Invoke-RestMethod -Uri "http://168.138.125.21:5678/api/v1/workflows/cFBr6GavlSWDsUFz" -Method PUT -Headers $headers -Body $body -TimeoutSec 60

Write-Host "SUCCESS!"