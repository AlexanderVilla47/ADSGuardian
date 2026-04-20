$apiKey = "__REDACTED_N8N_API_KEY__"

$headers = @{"Content-Type" = "application/json"; "X-N8N-API-KEY" = $apiKey}
$wf = Invoke-RestMethod -Uri "http://168.138.125.21:5678/api/v1/workflows/cFBr6GavlSWDsUFz" -Method GET -Headers $headers
$node = $wf.nodes | Where-Object { $_.name -eq "Validate Input" }
$js = $node.parameters.jsCode

# First line exactly
$firstLine = ($js -split "`n")[0]
Write-Host "First line: $firstLine"

# Try matching if 'consulta' is there
if ($firstLine -match "consulta") {
    Write-Host "consulta IS in allowed actions"
} else {
    Write-Host "consulta NOT in allowed actions!"
}