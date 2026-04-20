$headers = @{
    'X-N8N-API-KEY' = '__REDACTED_N8N_API_KEY__'
}
$workflow = Invoke-RestMethod -Uri 'http://168.138.125.21:5678/api/v1/workflows/rpnGFPo0nDthwzdB' -Headers $headers

$workflow.nodes | ForEach-Object {
    Write-Host "=== Node: $($_.name) ==="
    Write-Host "ID: $($_.id)"
    if ($_.parameters.jsCode) {
        Write-Host "Type: Code"
    } elseif ($_.parameters.rules) {
        Write-Host "Type: Switch"
        $_.parameters.rules.values | ForEach-Object {
            Write-Host "  Case: $($_.conditions.conditions[0].rightValue)"
        }
    } elseif ($_.parameters.httpMethod) {
        Write-Host "Type: Webhook"
    } elseif ($_.parameters.respondWith) {
        Write-Host "Type: RespondToWebhook"
    } elseif ($_.parameters.operation) {
        Write-Host "Type: GoogleSheets - $($_.parameters.operation)"
    } elseif ($_.parameters.workflowId) {
        Write-Host "Type: ExecuteWorkflow"
    }
    Write-Host ""
}