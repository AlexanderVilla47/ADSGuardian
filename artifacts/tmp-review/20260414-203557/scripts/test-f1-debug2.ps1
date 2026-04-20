$body = @{
    action = "alta"
    Contrato_ID = "CTR-8888"
    Cliente = "Test"
    Regex_Anuncio = "test"
    Fecha_Fin = "2026-04-30"
} | ConvertTo-Json -Compress

Write-Host "Body: $body"
$utf8Bytes = [System.Text.Encoding]::UTF8.GetBytes($body)

$response = Invoke-WebRequest -Uri 'http://168.138.125.21:5678/webhook/contract-ui-management' -Method POST -Body $utf8Bytes -ContentType 'application/json' -TimeoutSec 30

Write-Host "Status: $($response.StatusCode)"
Write-Host "Content Length: $($response.Content.Length)"
Write-Host "Content: $($response.Content.Substring(0, [Math]::Min(200, $response.Content.Length)))"