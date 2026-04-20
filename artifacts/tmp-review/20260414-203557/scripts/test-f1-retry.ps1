$headers = @{
    'X-N8N-API-KEY' = '__REDACTED_N8N_API_KEY__'
}

$body = @{
    action = "consulta"
    dias_proximos = 7
} | ConvertTo-Json

$utf8Bytes = [System.Text.Encoding]::UTF8.GetBytes($body)

$retry = 0
$maxRetries = 5

while ($retry -lt $maxRetries) {
    try {
        $response = Invoke-WebRequest -Uri 'http://168.138.125.21:5678/webhook/contract-ui-management' -Method POST -Body $utf8Bytes -ContentType 'application/json' -TimeoutSec 30
        Write-Host "Attempt $retry - Status: $($response.StatusCode)"
        if ($response.StatusCode -eq 200) {
            Write-Host "Content: $($response.Content)"
            break
        }
    } catch {
        Write-Host "Attempt $retry - Error: $($_.Exception.Message)"
    }
    $retry++
    Start-Sleep -Seconds 1
}

Start-Sleep -Seconds 3

$url = 'http://168.138.125.21:5678/api/v1/executions?workflowId=rpnGFPo0nDthwzdB&limit=1&includeData=true'
$response2 = Invoke-RestMethod -Uri $url -Headers $headers
$execId = $response2.data[0].id
Write-Host "Execution ID: $execId"
Write-Host "Status: $($response2.data[0].status)"

$runData = $response2.data[0].data.resultData.runData
$runData.PSObject.Properties.Name | ForEach-Object {
    $nodeName = $_
    $nodeData = $runData.$nodeName
    Write-Host "  $nodeName : $($nodeData[0].executionStatus)"
}