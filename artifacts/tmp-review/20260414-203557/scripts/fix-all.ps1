$apiKey = "__REDACTED_N8N_API_KEY__"

$headers = @{"Content-Type" = "application/json"; "X-N8N-API-KEY" = $apiKey}
$wf = Invoke-RestMethod -Uri "http://168.138.125.21.nip.io:5678/api/v1/workflows/cFBr6GavlSWDsUFz" -Method GET -Headers $headers

$fixed = 0
foreach ($node in $wf.nodes) {
    if ($node.type -eq "n8n-nodes-base.googleSheets") {
        if ($node.credentials.googleSheetsOAuth2Api) {
            Write-Host "Fixing: $($node.name)"
            $node.credentials = @{googleApi = @{}}
            $fixed++
        }
    }
}

Write-Host "Fixed $fixed nodes"

# Push back
Write-Host "Pushing workflow..."
$body = $wf | ConvertTo-Json -Depth 20
try {
    $r = Invoke-RestMethod -Uri "http://168.138.125.21.nip.io:5678/api/v1/workflows/cFBr6GavlSWDsUFz" -Method PUT -Headers $headers -Body $body -TimeoutSec 60
    Write-Host "SUCCESS! Fixed $fixed nodes"
} catch {
    Write-Host "ERROR: $($_.Exception.Message)"
}