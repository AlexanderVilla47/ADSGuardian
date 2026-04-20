$apiKey = "__REDACTED_N8N_API_KEY__"

$headers = @{"Content-Type" = "application/json"; "X-N8N-API-KEY" = $apiKey}
$wf = Invoke-RestMethod -Uri "http://168.138.125.21:5678/api/v1/workflows/cFBr6GavlSWDsUFz" -Method GET -Headers $headers
$node = $wf.nodes | Where-Object { $_.name -eq "Route Action" }
Write-Host "Switch cases: $($node.parameters.rules | ConvertTo-Json -Compress)"