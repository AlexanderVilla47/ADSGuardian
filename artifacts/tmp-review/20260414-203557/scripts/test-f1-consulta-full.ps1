$body = @{
    action = "consulta"
    dias_proximos = 7
} | ConvertTo-Json

$utf8Bytes = [System.Text.Encoding]::UTF8.GetBytes($body)
$response = Invoke-WebRequest -Uri 'http://168.138.125.21:5678/webhook/contract-ui-management' -Method POST -Body $utf8Bytes -ContentType 'application/json' -TimeoutSec 30 -ErrorAction SilentlyContinue

Write-Host "Status Code: $($response.StatusCode)"
Write-Host "Content: $($response.Content)"

Start-Sleep -Seconds 2

$headers = @{
    'X-N8N-API-KEY' = '__REDACTED_N8N_API_KEY__'
}

$url = 'http://168.138.125.21:5678/api/v1/executions?workflowId=rpnGFPo0nDthwzdB&limit=1&includeData=true'
$response2 = Invoke-RestMethod -Uri $url -Headers $headers
Write-Host "Execution ID: $($response2.data[0].id)"
Write-Host "Status: $($response2.data[0].status)"
$response2.data[0].data.resultData.runData.PSObject.Properties.Name | ForEach-Object {
    $nodeName = $_
    $nodeData = $response2.data[0].data.resultData.runData.$nodeName
    Write-Host "  $nodeName : $($nodeData[0].executionStatus)"
}