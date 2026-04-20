$apiKey = "__REDACTED_N8N_API_KEY__"

$headers = @{"Content-Type" = "application/json"; "X-N8N-API-KEY" = $apiKey}
$wf = Invoke-RestMethod -Uri "http://168.138.125.21.nip.io:5678/api/v1/workflows/cFBr6GavlSWDsUFz" -Method GET -Headers $headers

$n1 = $wf.nodes | Where-Object { $_.name -eq "GS Read Contratos" }
$n2 = $wf.nodes | Where-Object { $_.name -eq "GS Append Alta" }

Write-Host "GS Read Contratos:"
Write-Host "  credentials: $($n1.credentials)"
Write-Host "  authentication: $($n1.authentication)"
Write-Host "GS Append Alta:"
Write-Host "  credentials: $($n2.credentials)"  
Write-Host "  authentication: $($n2.authentication)"