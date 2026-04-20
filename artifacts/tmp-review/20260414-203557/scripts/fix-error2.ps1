$apiKey = "__REDACTED_N8N_API_KEY__"

$headers = @{"Content-Type" = "application/json"; "X-N8N-API-KEY" = $apiKey}
$wf = Invoke-RestMethod -Uri "http://168.138.125.21:5678/api/v1/workflows/cFBr6GavlSWDsUFz" -Method GET -Headers $headers
$node = $wf.nodes | Where-Object { $_.name -eq "Validate Input" }

$js = $node.parameters.jsCode
$old = "Usar: alta | consulta"
$new = "Usar: alta | search | consulta"
$js = $js.Replace($old, $new)

$node.parameters.jsCode = $js

$payload = @{name = $wf.name; nodes = $wf.nodes; connections = $wf.connections; settings = $wf.settings; staticData = $null}
$body = $payload | ConvertTo-Json -Depth 15
$r = Invoke-RestMethod -Uri "http://168.138.125.21:5678/api/v1/workflows/cFBr6GavlSWDsUFz" -Method PUT -Headers $headers -Body $body -TimeoutSec 60
Write-Host "Done"