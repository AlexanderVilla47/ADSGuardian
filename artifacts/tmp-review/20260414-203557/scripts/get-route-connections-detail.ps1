$headers = @{
    'X-N8N-API-KEY' = '__REDACTED_N8N_API_KEY__'
}
$workflow = Invoke-RestMethod -Uri 'http://168.138.125.21:5678/api/v1/workflows/rpnGFPo0nDthwzdB' -Headers $headers

Write-Host "=== Connections from Route Action ==="
$routeConnections = $workflow.connections.'Route Action'.main
for ($i = 0; $i -lt $routeConnections.Count; $i++) {
    $output = $routeConnections[$i]
    Write-Host "Output $i :"
    $output.value | ForEach-Object {
        Write-Host "  -> $($_.node)"
    }
}