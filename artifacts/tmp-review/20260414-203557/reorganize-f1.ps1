$headers = @{'X-N8N-API-KEY'='__REDACTED_N8N_API_KEY__'}

# Get current workflow
$workflow = Invoke-RestMethod -Uri 'http://168.138.125.21:5678/api/v1/workflows/rpnGFPo0nDthwzdB' -Headers $headers
$workflowJson = $workflow | ConvertTo-Json -Depth 30
$workflowObj = $workflowJson | ConvertFrom-Json

# Reorganize nodes with consistent positions
$nodes = @()

# Row 1: Trigger (Y=100)
$nodes += @{
    id = "1"
    name = "Webhook UI"
    position = @(250, 100)
}

# Row 1: Normalize (Y=100)
$nodes += @{
    id = "2"
    name = "Normalize Request"
    position = @(470, 100)
}

# Row 2: Validate (Y=300)
$nodes += @{
    id = "3"
    name = "Validate Input"
    position = @(690, 300)
}

# Row 2: Route (Y=300)
$nodes += @{
    id = "4"
    name = "Route Action"
    position = @(910, 300)
}

# ALTA branch - Row 3 (Y=500)
$nodes += @{
    id = "5"
    name = "Build Alta Row"
    position = @(1130, 500)
}
$nodes += @{
    id = "6"
    name = "GS Append Alta"
    position = @(1350, 500)
}
$nodes += @{
    id = "7"
    name = "Respond Alta"
    position = @(1570, 500)
}

# CONSULTA branch - Row 4 (Y=700)
$nodes += @{
    id = "8"
    name = "GS Read Contratos"
    position = @(1130, 700)
}
$nodes += @{
    id = "9"
    name = "Filter Proximos Vencer"
    position = @(1350, 700)
}
$nodes += @{
    id = "10"
    name = "Respond Consulta"
    position = @(1570, 700)
}

# EXTENSION branch - Row 5 (Y=900)
$nodes += @{
    id = "11"
    name = "GS Read For Extension"
    position = @(1130, 900)
}
$nodes += @{
    id = "12"
    name = "Build Extension Row"
    position = @(1350, 900)
}
$nodes += @{
    id = "13"
    name = "GS Update Extension"
    position = @(1570, 900)
}
$nodes += @{
    id = "14"
    name = "Respond Extension"
    position = @(1790, 900)
}

# Chaining F1->F2 - Row 6 (Y=1100)
$nodes += @{
    id = "15"
    name = "Build Internal Payload F1->F2"
    position = @(690, 1100)
}
$nodes += @{
    id = "16"
    name = "Execute F2 Internal"
    position = @(910, 1100)
}
$nodes += @{
    id = "17"
    name = "Log F1 Chain Dispatch OK"
    position = @(1130, 1100)
}
$nodes += @{
    id = "18"
    name = "Log F1 Chain Dispatch Error"
    position = @(1130, 1250)
}

# Update positions in workflow
$workflowObj.nodes | ForEach-Object {
    $nodeId = $_.id
    $newNode = $nodes | Where-Object { $_.id -eq $nodeId }
    if ($newNode) {
        $_.position = @($newNode.position[0], $newNode.position[1])
        $_.name = $newNode.name
    }
}

# Update workflow
$body = @{
    name = $workflowObj.name
    nodes = $workflowObj.nodes
    connections = $workflowObj.connections
    settings = $workflowObj.settings
    staticData = $workflowObj.staticData
    meta = $workflowObj.meta
} | ConvertTo-Json -Depth 20

$body | Out-File -FilePath "C:\Users\Usuario\Desktop\Proyectos\Automatizaciones\AdsKiller\update-workflow.json" -Encoding UTF8
Write-Output "Workflow JSON prepared, now deploying..."