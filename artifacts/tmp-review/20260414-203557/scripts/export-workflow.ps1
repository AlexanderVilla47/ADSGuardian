$apiKey = "__REDACTED_N8N_API_KEY__"

$headers = @{"Content-Type" = "application/json"; "X-N8N-API-KEY" = $apiKey}

# Get workflow and save as file for manual import
Write-Host "Getting workflow..."
$wf = Invoke-RestMethod -Uri "http://168.138.125.21:5678/api/v1/workflows/cFBr6GavlSWDsUFz" -Method GET -Headers $headers

# Save to local file
$wf | ConvertTo-Json -Depth 20 | Out-File -FilePath "workflows/contract-ui-management-v2-search-ready.json" -Encoding UTF8

Write-Host "Saved to workflows/contract-ui-management-v2-search-ready.json"
Write-Host "Import this file in n8n to add search handler"