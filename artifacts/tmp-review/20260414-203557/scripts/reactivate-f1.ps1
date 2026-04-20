$headers = @{
    'X-N8N-API-KEY' = '__REDACTED_N8N_API_KEY__'
}

Write-Host "Deactivating F1..."
$deactivateUrl = 'http://168.138.125.21:5678/api/v1/activations/rpnGFPo0nDthwzdB'
$deactivateResult = Invoke-RestMethod -Uri $deactivateUrl -Headers $headers -Method DELETE
Write-Host "Deactivate: $($deactivateResult.activated)"

Start-Sleep -Seconds 2

Write-Host "Activating F1..."
$activateUrl = 'http://168.138.125.21:5678/api/v1/activations/rpnGFPo0nDthwzdB'
$activateResult = Invoke-RestMethod -Uri $activateUrl -Headers $headers -Method POST
Write-Host "Activate: $($activateResult.activated)"