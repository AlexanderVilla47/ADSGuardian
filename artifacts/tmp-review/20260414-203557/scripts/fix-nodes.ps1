Add-Type -AssemblyName System.Web

$apiKey = "__REDACTED_N8N_API_KEY__"
$baseUrl = "http://168.138.125.21.nip.io:5678"
$workflowId = "cFBr6GavlSWDsUFz"

$headers = @{
    "Content-Type" = "application/json"
    "X-N8N-API-KEY" = $apiKey
}

# Get workflow
Write-Host "Fetching workflow..."
$wf = Invoke-RestMethod -Uri "$baseUrl/api/v1/workflows/$workflowId" -Method GET -Headers $headers

# Find nodes needing fix
$nodes = $wf.nodes | Where-Object { 
    $_.type -eq "n8n-nodes-base.googleSheets" -and 
    $_.credentials -and 
    $_.credentials.PSObject.Properties.Count -eq 0 
}

Write-Host "Found $($nodes.Count) nodes to fix"

$fixed = 0
foreach ($node in $nodes) {
    Write-Host "Fixing: $($node.name)"
    # Add authentication property
    $node | Add-Member -NotePropertyName "authentication" -NotePropertyValue "serviceAccount" -Force
    $fixed++
}

Write-Host "Fixed $fixed nodes"

# Push back
Write-Host "Pushing workflow..."
$body = $wf | ConvertTo-Json -Depth 20
try {
    $r = Invoke-RestMethod -Uri "$baseUrl/api/v1/workflows/$workflowId" -Method PUT -Headers $headers -Body $body -TimeoutSec 60
    Write-Host "SUCCESS!"
} catch {
    Write-Host "ERROR: $($_.Exception.Message)"
}