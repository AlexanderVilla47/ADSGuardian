$headers = @{
    'X-N8N-API-KEY' = '__REDACTED_N8N_API_KEY__'
}
$workflow = Invoke-RestMethod -Uri 'http://168.138.125.21:5678/api/v1/workflows/rpnGFPo0nDthwzdB' -Headers $headers

$cleanSettings = @{
    executionOrder = "v1"
    callerPolicy = "workflowsFromSameOwner"
}

$payload = @{
    name = $workflow.name
    nodes = $workflow.nodes
    connections = $workflow.connections
    settings = $cleanSettings
}

$jsonPayload = $payload | ConvertTo-Json -Depth 20
$utf8Bytes = [System.Text.Encoding]::UTF8.GetBytes($jsonPayload)
$response = Invoke-RestMethod -Uri 'http://168.138.125.21:5678/api/v1/workflows/rpnGFPo0nDthwzdB' -Headers $headers -Method PUT -Body $utf8Bytes -ContentType 'application/json'
Write-Host "Current settings:"
$workflow.settings | ConvertTo-Json -Depth 3