$headers = @{
    'X-N8N-API-KEY' = '__REDACTED_N8N_API_KEY__'
}
$body = @{
    action = "alta"
    Contrato_ID = "CTR-9002"
    Cliente = "Test Cliente Chain"
    Regex_Anuncio = "test.*chain"
    Fecha_Fin = "2026-04-20"
    correlation_id = "ak-test-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
} | ConvertTo-Json

$utf8Bytes = [System.Text.Encoding]::UTF8.GetBytes($body)
$response = Invoke-RestMethod -Uri 'http://168.138.125.21:5678/webhook/contract-ui-management' -Headers $headers -Method POST -Body $utf8Bytes -ContentType 'application/json'
$response | ConvertTo-Json -Depth 10