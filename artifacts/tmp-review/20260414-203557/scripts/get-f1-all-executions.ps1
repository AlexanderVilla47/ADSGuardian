$headers = @{
    'X-N8N-API-KEY' = '__REDACTED_N8N_API_KEY__'
}
$url = 'http://168.138.125.21:5678/api/v1/executions?workflowId=rpnGFPo0nDthwzdB&limit=5&includeData=true'
$response = Invoke-RestMethod -Uri $url -Headers $headers

$response.data | ForEach-Object {
    Write-Host "=== Execution $($_.id) - $($_.status) ==="
    $runData = $_.data.resultData.runData
    $runData.PSObject.Properties.Name | ForEach-Object {
        $nodeName = $_
        $nodeData = $runData.$nodeName
        Write-Host "  $nodeName : $($nodeData[0].executionStatus)"
    }
    Write-Host ""
}