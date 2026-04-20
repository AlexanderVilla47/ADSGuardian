$headers = @{
    'X-N8N-API-KEY' = '__REDACTED_N8N_API_KEY__'
}
$workflow = Invoke-RestMethod -Uri 'http://168.138.125.21:5678/api/v1/workflows/rpnGFPo0nDthwzdB' -Headers $headers

$routeNode = $workflow.nodes | Where-Object { $_.name -eq 'Route Action' }

Write-Host "Route Action rules structure:"
$routeNode.parameters.rules.values | ForEach-Object {
    $i = 0
    $_.PSObject.Properties.Name | ForEach-Object {
        Write-Host "  Prop: $_ = $($_.$i)"
    }
}

Write-Host "`nConditions in detail:"
$routeNode.parameters.rules.values | ForEach-Object {
    Write-Host "  Condition:"
    $_.conditions.conditions | ForEach-Object {
        Write-Host "    leftValue: $($_.leftValue)"
        Write-Host "    rightValue: $($_.rightValue)"
        Write-Host "    operation: $($_.operator.operation)"
    }
}