$headers = @{
    'X-N8N-API-KEY' = '__REDACTED_N8N_API_KEY__'
}
$workflow = Invoke-RestMethod -Uri 'http://168.138.125.21:5678/api/v1/workflows/rpnGFPo0nDthwzdB' -Headers $headers

$routeNode = $workflow.nodes | Where-Object { $_.name -eq 'Route Action' }
Write-Host "Route Action rules (current):"
$routeNode.parameters.rules | ConvertTo-Json -Depth 10