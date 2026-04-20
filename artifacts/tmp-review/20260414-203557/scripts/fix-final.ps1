$apiKey = "__REDACTED_N8N_API_KEY__"

$headers = @{"Content-Type" = "application/json"; "X-N8N-API-KEY" = $apiKey}
$wf = Invoke-RestMethod -Uri "http://168.138.125.21:5678/api/v1/workflows/cFBr6GavlSWDsUFz" -Method GET -Headers $headers

# Fix nodes - add authentication: serviceAccount to parameters
$gsNodes = @("GS Append Alta","GS Read For Extension","GS Update Extension","GS Read For Baja","GS Update Baja","GS Read For Listar Ads","GS Append Operation Log","GS Read Operations History","GS Read For Pause Active Preview")

foreach ($name in $gsNodes) {
    $node = $wf.nodes | Where-Object { $_.name -eq $name }
    if ($node) {
        Write-Host "Fixing: $name"
        # Get parameters as hashtable
        $p = $node.parameters
        # Add authentication
        $p | Add-Member -NotePropertyName "authentication" -NotePropertyValue "serviceAccount" -Force
        $node.parameters = $p
    }
}

# Push minimal
$payload = @{
    name = $wf.name
    nodes = $wf.nodes
    connections = $wf.connections
    settings = $wf.settings
    staticData = $null
}

$body = $payload | ConvertTo-Json -Depth 15
Write-Host "Pushing..."
$r = Invoke-RestMethod -Uri "http://168.138.125.21:5678/api/v1/workflows/cFBr6GavlSWDsUFz" -Method PUT -Headers $headers -Body $body -TimeoutSec 60
Write-Host "SUCCESS! $($r.name)"