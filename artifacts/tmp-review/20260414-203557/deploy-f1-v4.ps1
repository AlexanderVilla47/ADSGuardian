$headers = @{'X-N8N-API-KEY'='__REDACTED_N8N_API_KEY__'}

# Get current workflow 
$workflow = Invoke-RestMethod -Uri 'http://168.138.125.21:5678/api/v1/workflows/rpnGFPo0nDthwzdB' -Headers $headers

# Read our updated nodes and connections
$updatedJson = Get-Content -Path "C:\Users\Usuario\Desktop\Proyectos\Automatizaciones\AdsKiller\update-workflow.json" -Raw | ConvertFrom-Json

# Build body with ONLY name, nodes, connections, settings - clean settings
# n8n PUT only accepts specific fields in settings
$cleanSettings = @{
    saveExecutionProgress = $true
    saveManualExecutions = $true
    saveDataErrorExecution = "all"
    saveDataSuccessExecution = "all"
}

$body = @{
    name = $workflow.name
    nodes = $updatedJson.nodes
    connections = $updatedJson.connections
    settings = $cleanSettings
} | ConvertTo-Json -Depth 20

$body | Out-File -FilePath "C:\Users\Usuario\Desktop\Proyectos\Automatizaciones\AdsKiller\deploy-body-v4.json" -Encoding UTF8

$response = Invoke-RestMethod -Uri 'http://168.138.125.21:5678/api/v1/workflows/rpnGFPo0nDthwzdB' -Headers $headers -Method PUT -Body $body -ContentType "application/json"
$response | ConvertTo-Json -Depth 10