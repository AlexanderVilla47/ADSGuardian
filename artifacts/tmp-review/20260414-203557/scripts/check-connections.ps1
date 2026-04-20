$apiKey = "__REDACTED_N8N_API_KEY__"

$headers = @{"Content-Type" = "application/json"; "X-N8N-API-KEY" = $apiKey}
$wf = Invoke-RestMethod -Uri "http://168.138.125.21:5678/api/v1/workflows/cFBr6GavlSWDsUFz" -Method GET -Headers $headers

# Find Route Action output connections
$conns = $wf.connections
$raConns = $conns.PSObject.Properties | Where-Object { $_.Name -eq "Route Action" }
Write-Host "Route Action connections:"
$raConns.Value.main[0] | ForEach-Object { Write-Host "  Case $($_.PSObject.Properties.Name): $($_.PSObject.Properties.Value)" }