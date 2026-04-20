$body = '{}'
$response = Invoke-WebRequest -Uri 'http://168.138.125.21:5678/webhook/contract-ui-management' -Method POST -Body $body -ContentType 'application/json' -TimeoutSec 30

Write-Host "Status: $($response.StatusCode)"
Write-Host "Content: $($response.Content)"

Start-Sleep -Seconds 2

$headers = @{
    'X-N8N-API-KEY' = '__REDACTED_N8N_API_KEY__'
}
$url = 'http://168.138.125.21:5678/api/v1/executions?workflowId=rpnGFPo0nDthwzdB&limit=1&includeData=true'
$response2 = Invoke-RestMethod -Uri $url -Headers $headers

$runData = $response2.data[0].data.resultData.runData
$runData.PSObject.Properties.Name | ForEach-Object {
    $nodeName = $_
    $nodeData = $runData.$nodeName
    Write-Host "  $nodeName : $($nodeData[0].executionStatus)"
}