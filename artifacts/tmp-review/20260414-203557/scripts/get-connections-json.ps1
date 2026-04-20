$headers = @{
    'X-N8N-API-KEY' = '__REDACTED_N8N_API_KEY__'
}
$workflow = Invoke-RestMethod -Uri 'http://168.138.125.21:5678/api/v1/workflows/rpnGFPo0nDthwzdB' -Headers $headers

Write-Host "=== Full Connections JSON ==="
$workflow.connections.'Route Action' | ConvertTo-Json -Depth 15