$apiKey = "__REDACTED_N8N_API_KEY__"

$headers = @{"Content-Type" = "application/json"; "X-N8N-API-KEY" = $apiKey}
$wf = Invoke-RestMethod -Uri "http://168.138.125.21:5678/api/v1/workflows/cFBr6GavlSWDsUFz" -Method GET -Headers $headers

# Compare working vs non-working
$r1 = $wf.nodes | Where-Object { $_.name -eq "GS Read Contratos" }
$r2 = $wf.nodes | Where-Object { $_.name -eq "GS Append Alta" }

Write-Host "=== GS Read Contratos (WORKS) ==="
Write-Host "type: $($r1.type)"
Write-Host "credentials: $($r1.credentials)"
Write-Host "authentication: $($r1.authentication)"
Write-Host "parameters: $($r1.parameters | ConvertTo-Json -Compress)"

Write-Host ""
Write-Host "=== GS Append Alta (FAILS) ==="
Write-Host "type: $($r2.type)"
Write-Host "credentials: $($r2.credentials)"
Write-Host "authentication: $($r2.authentication)"
Write-Host "parameters: $($r2.parameters | ConvertTo-Json -Compress)"