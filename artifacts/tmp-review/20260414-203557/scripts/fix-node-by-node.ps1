$apiKey = "__REDACTED_N8N_API_KEY__"

$headers = @{"Content-Type" = "application/json"; "X-N8N-API-KEY" = $apiKey}

# Get workflow
$wf = Invoke-RestMethod -Uri "http://168.138.125.21.nip.io:5678/api/v1/workflows/cFBr6GavlSWDsUFz" -Method GET -Headers $headers

# Get nodes array only
$nodes = $wf.nodes

# Fix each GS node
$gsNodes = @("GS Append Alta","GS Read For Extension","GS Update Extension","GS Read For Baja","GS Update Baja","GS Read For Listar Ads","GS Append Operation Log","GS Read Operations History","GS Read For Pause Active Preview")

foreach ($name in $gsNodes) {
    $node = $nodes | Where-Object { $_.name -eq $name }
    if ($node -and $node.credentials.googleSheetsOAuth2Api) {
        Write-Host "FIXING: $name"
        $node.credentials = @{googleApi = @{}}
    }
}

# Create minimal payload - just nodes and connections
$payload = @{
    nodes = $nodes
    connections = $wf.connections
    settings = $wf.settings
    staticData = $null
    pinData = @{}
}

$json = $payload | ConvertTo-Json -Depth 20

# Try PUT
try {
    $r = Invoke-RestMethod -Uri "http://168.138.125.21.nip.io:5678/api/v1/workflows/cFBr6GavlSWDsUFz" -Method PUT -Headers $headers -Body $json -TimeoutSec 60
    Write-Host "SUCCESS!"
} catch {
    Write-Host "ERROR: "$_.Exception.Message
}