$apiKey = "__REDACTED_N8N_API_KEY__"

$headers = @{"Content-Type" = "application/json"; "X-N8N-API-KEY" = $apiKey}
$wf = Invoke-RestMethod -Uri "http://168.138.125.21:5678/api/v1/workflows/cFBr6GavlSWDsUFz" -Method GET -Headers $headers

# Verify all GS nodes
$gsNodes = $wf.nodes | Where-Object { $_.type -eq "n8n-nodes-base.googleSheets" }

foreach ($node in $gsNodes) {
    $creds = $node.credentials
    $auth = $node.parameters.authentication
    $status = if ($creds.googleApi -and $auth -eq "serviceAccount") { "OK" } else { "FAIL" }
    Write-Host "$($node.name): credentials=$($creds.PSObject.Properties.Name) auth=$auth -> $status"
}