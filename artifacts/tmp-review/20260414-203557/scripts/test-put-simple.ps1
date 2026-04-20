$apiKey = "__REDACTED_N8N_API_KEY__"

$headers = @{"Content-Type" = "application/json"; "X-N8N-API-KEY" = $apiKey}

# GET workflow
Write-Host "GET workflow..."
$wf = Invoke-RestMethod -Uri "http://168.138.125.21:5678/api/v1/workflows/cFBr6GavlSWDsUFz" -Method GET -Headers $headers

# Change just ONE node's credentials lightly
$node = $wf.nodes | Where-Object { $_.name -eq "GS Append Alta" }
Write-Host "Before: $($node.credentials)"

# Change to googleApi
$node.credentials = @{googleApi = @{}}

Write-Host "After: $($node.credentials)"

# Push back MINIMAL
$payload = @{
    name = $wf.name
    nodes = $wf.nodes
    connections = $wf.connections
    settings = $wf.settings
    staticData = $null
}

Write-Host "Pushing..."
$body = $payload | ConvertTo-Json -Depth 15
$r = Invoke-RestMethod -Uri "http://168.138.125.21:5678/api/v1/workflows/cFBr6GavlSWDsUFz" -Method PUT -Headers $headers -Body $body -TimeoutSec 60
Write-Host "DONE! $($r.name)"