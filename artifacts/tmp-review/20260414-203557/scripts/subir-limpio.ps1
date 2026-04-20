$apiKey = "__REDACTED_N8N_API_KEY__"

# Load and clean
$wf = Get-Content "workflows/contract-ui-management-v2-search-ready.json" -Raw | ConvertFrom-Json

# Remove extra fields
$clean = @{
    name = $wf.name
    nodes = $wf.nodes
    connections = $wf.connections
    settings = $wf.settings
    staticData = $null
    pinData = @{}
}

$body = $clean | ConvertTo-Json -Depth 20

$headers = @{"Content-Type" = "application/json"; "X-N8N-API-KEY" = $apiKey}

Write-Host "Pushing clean workflow..." -NoNewline
$r = Invoke-RestMethod -Uri "http://168.138.125.21:5678/api/v1/workflows/cFBr6GavlSWDsUFz" -Method PUT -Headers $headers -Body $body -TimeoutSec 60

Write-Host " DONE! $($r.name)"