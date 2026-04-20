$headers = @{'X-N8N-API-KEY'='__REDACTED_N8N_API_KEY__'}

# Get current workflow 
$workflow = Invoke-RestMethod -Uri 'http://168.138.125.21:5678/api/v1/workflows/rpnGFPo0nDthwzdB' -Headers $headers

# Get nodes from workflow - they must remain intact
$nodes = $workflow.nodes

# Update positions for each node
$positionMap = @{
    "1" = @(250, 100)
    "2" = @(470, 100)
    "3" = @(690, 300)
    "4" = @(910, 300)
    "5" = @(1130, 500)
    "6" = @(1350, 500)
    "7" = @(1570, 500)
    "8" = @(1130, 700)
    "9" = @(1350, 700)
    "10" = @(1570, 700)
    "11" = @(1130, 900)
    "12" = @(1350, 900)
    "13" = @(1570, 900)
    "14" = @(1790, 900)
    "15" = @(690, 1100)
    "16" = @(910, 1100)
    "17" = @(1130, 1100)
    "18" = @(1130, 1250)
}

$nameMap = @{
    "1" = "Webhook UI"
    "2" = "Normalize Request"
    "3" = "Validate Input"
    "4" = "Route Action"
    "5" = "Build Alta Row"
    "6" = "GS Append Alta"
    "7" = "Respond Alta"
    "8" = "GS Read Contratos"
    "9" = "Filter Proximos Vencer"
    "10" = "Respond Consulta"
    "11" = "GS Read For Extension"
    "12" = "Build Extension Row"
    "13" = "GS Update Extension"
    "14" = "Respond Extension"
    "15" = "Build Internal Payload F1->F2"
    "16" = "Execute F2 Internal"
    "17" = "Log F1 Chain Dispatch OK"
    "18" = "Log F1 Chain Dispatch Error"
}

# Update each node
foreach ($node in $nodes) {
    if ($positionMap.ContainsKey($node.id)) {
        $node.position = $positionMap[$node.id]
    }
    if ($nameMap.ContainsKey($node.id)) {
        $node.name = $nameMap[$node.id]
    }
}

# Build body - serialize properly as array not hashtable
$body = @{
    name = $workflow.name
    nodes = @($nodes)
    connections = $workflow.connections
    settings = @{
        saveExecutionProgress = $true
        saveManualExecutions = $true
        saveDataErrorExecution = "all"
        saveDataSuccessExecution = "all"
    }
} | ConvertTo-Json -Depth 20 -AsArray

$body | Out-File -FilePath "C:\Users\Usuario\Desktop\Proyectos\Automatizaciones\AdsKiller\deploy-body-v5.json" -Encoding UTF8

$response = Invoke-RestMethod -Uri 'http://168.138.125.21:5678/api/v1/workflows/rpnGFPo0nDthwzdB' -Headers $headers -Method PUT -Body $body -ContentType "application/json"
$response | ConvertTo-Json -Depth 10