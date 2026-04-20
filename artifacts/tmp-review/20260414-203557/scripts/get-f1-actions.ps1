$headers = @{
    'X-N8N-API-KEY' = '__REDACTED_N8N_API_KEY__'
}
$url = 'http://168.138.125.21:5678/api/v1/executions?workflowId=rpnGFPo0nDthwzdB&limit=10&includeData=true'
$response = Invoke-RestMethod -Uri $url -Headers $headers

$response.data | ForEach-Object {
    $runData = $_.data.resultData.runData
    $inputJson = $runData.'Webhook UI'[0].data.main[0][0].json.body
    Write-Host "ID: $($_.id) - Status: $($_.status) - Action: $($inputJson.action)"
    Write-Host "  Last node: $($_.data.resultData.lastNodeExecuted)"
}