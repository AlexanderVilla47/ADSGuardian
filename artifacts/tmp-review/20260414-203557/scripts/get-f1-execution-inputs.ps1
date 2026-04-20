$headers = @{
    'X-N8N-API-KEY' = '__REDACTED_N8N_API_KEY__'
}
$url = 'http://168.138.125.21:5678/api/v1/executions?workflowId=rpnGFPo0nDthwzdB&limit=1&includeData=true'
$response = Invoke-RestMethod -Uri $url -Headers $headers

$runData = $response.data[0].data.resultData.runData

Write-Host "Webhook UI input:"
$runData.'Webhook UI'[0].data.main[0][0].json.body | ConvertTo-Json

Write-Host "`nNormalize Request output:"
$runData.'Normalize Request'[0].data.main[0][0].json | ConvertTo-Json

Write-Host "`nValidate Input output:"
$runData.'Validate Input'[0].data.main[0][0].json | ConvertTo-Json

Write-Host "`nRoute Action input:"
$runData.'Route Action'[0].data.main[0][0].json | ConvertTo-Json