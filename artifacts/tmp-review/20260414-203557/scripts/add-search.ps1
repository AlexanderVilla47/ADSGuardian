$apiKey = "__REDACTED_N8N_API_KEY__"

$headers = @{"Content-Type" = "application/json"; "X-N8N-API-KEY" = $apiKey}
$wf = Invoke-RestMethod -Uri "http://168.138.125.21:5678/api/v1/workflows/cFBr6GavlSWDsUFz" -Method GET -Headers $headers

# Find Validate Input node and add "search" to allowed actions
$node = $wf.nodes | Where-Object { $_.name -eq "Validate Input" }
$js = $node.parameters.jsCode

# Add search to allowed actions
$js = $js -replace "new Set\(\['alta'","new Set(['alta','search'"

# Also add search validation
$searchValidation = @"
if (input.action === 'search') {
  if (!String(input.q ?? '').trim()) badRequest('q es obligatorio para search');
  input.q = String(input.q).trim();
}
"@

if ($js -notmatch "input.action === 'search'") {
    $js = $js -replace "if \(input\.action === 'consulta'\)", "$searchValidation`n`$1"
}

$node.parameters.jsCode = $js

$payload = @{name = $wf.name; nodes = $wf.nodes; connections = $wf.connections; settings = $wf.settings; staticData = $null}
$body = $payload | ConvertTo-Json -Depth 15
$r = Invoke-RestMethod -Uri "http://168.138.125.21:5678/api/v1/workflows/cFBr6GavlSWDsUFz" -Method PUT -Headers $headers -Body $body -TimeoutSec 60
Write-Host "Added search action!"