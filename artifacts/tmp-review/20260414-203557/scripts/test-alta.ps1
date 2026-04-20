$body = @{
    action = "alta"
    Contrato_ID = "TEST-999"
    Cliente = "TestClient"
    Regex_Anuncio = ".*test.*"
    Fecha_Fin = "2026-12-31"
    requested_by = "test"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://168.138.125.21.nip.io:5678/webhook/contract-ui-management-v2" -Method POST -Body $body -ContentType "application/json"