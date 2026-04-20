$apiKey = "__REDACTED_N8N_API_KEY__"
$baseUrl = "http://168.138.125.21.nip.io:5678"

$headers = @{
    "Content-Type" = "application/json"
    "X-N8N-API-KEY" = $apiKey
}

$wf = Invoke-RestMethod -Uri "$baseUrl/api/v1/workflows/cFBr6GavlSWDsUFz" -Method GET -Headers $headers

# Find GS Append Alta
$node = $wf.nodes | Where-Object { $_.name -eq "GS Append Alta" }
Write-Host "GS Append Alta:"
Write-Host "  type: $($node.type)"
Write-Host "  credentials: $($node.credentials)"
Write-Host "  authentication: $($node.authentication)"
if ($node.parameters) {
    Write-Host "  parameters: present"
}