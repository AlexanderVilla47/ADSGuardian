$apiKey = "__REDACTED_N8N_API_KEY__"

$headers = @{
    "Content-Type" = "application/json"
    "X-N8N-API-KEY" = $apiKey
}

# Get, fix locally, serialize properly
$wf = Invoke-RestMethod -Uri "http://168.138.125.21.nip.io:5678/api/v1/workflows/cFBr6GavlSWDsUFz" -Method GET -Headers $headers

# Fix credentials
$gsNodes = @("GS Append Alta","GS Read For Extension","GS Update Extension","GS Read For Baja","GS Update Baja","GS Read For Listar Ads","GS Append Operation Log","GS Read Operations History","GS Read For Pause Active Preview")
foreach ($name in $gsNodes) {
    $node = $wf.nodes | Where-Object { $_.name -eq $name }
    if ($node) {
        Write-Host "Setting $name -> googleApi"
        $node.credentials = @{googleApi = @{}}
    }
}

# Convert to JSON (properly serialize)
$json = $wf | ConvertTo-Json -Depth 30 -Compress

# Try PUT with the exact JSON
$resp = Invoke-RestMethod -Uri "http://168.138.125.21.nip.io:5678/api/v1/workflows/cFBr6GavlSWDsUFz" -Method PUT -Headers $headers -Body $json -TimeoutSec 60 -ErrorAction Stop

Write-Host "DONE! Response: $($resp.name)"