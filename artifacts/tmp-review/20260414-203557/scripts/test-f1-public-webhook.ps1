$body = @{
    action = "consulta"
    dias_proximos = 7
} | ConvertTo-Json

$utf8Bytes = [System.Text.Encoding]::UTF8.GetBytes($body)
$response = Invoke-WebRequest -Uri 'http://168.138.125.21.nip.io:5678/webhook/contract-ui-management' -Method POST -Body $utf8Bytes -ContentType 'application/json' -TimeoutSec 30
Write-Host "Status: $($response.StatusCode)"
$response.Content