$headers = @{
    'X-N8N-API-KEY' = '__REDACTED_N8N_API_KEY__'
}
$workflow = Invoke-RestMethod -Uri 'http://168.138.125.21:5678/api/v1/workflows/rpnGFPo0nDthwzdB' -Headers $headers

$executeF2Node = $workflow.nodes | Where-Object { $_.name -eq 'Execute F2 Internal' }
Write-Host "Execute F2 Internal config:"
$executeF2Node.parameters | ConvertTo-Json -Depth 5