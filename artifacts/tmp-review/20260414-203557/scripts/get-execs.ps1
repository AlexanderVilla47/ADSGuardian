$apiKey = "__REDACTED_N8N_API_KEY__"

$headers = @{"Content-Type" = "application/json"; "X-N8N-API-KEY" = $apiKey}

# Get executions
$execs = Invoke-RestMethod -Uri "http://168.138.125.21:5678/api/v1/executions?workflowId=cFBr6GavlSWDsUFz&limit=3" -Method GET -Headers $headers -TimeoutSec 30

Write-Host "Recent executions:"
$execs.data | ForEach-Object { Write-Host "$($_.id) - $($_.status) - $($_.finishedAt)" }