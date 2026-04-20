$bodyContent = '{"action":"consulta","dias_proximos":7,"requested_by":"test"}'

$response = Invoke-RestMethod -Uri "http://168.138.125.21.nip.io:5678/webhook/contract-ui-management-v2" -Method POST -Body $bodyContent -ContentType "application/json" -TimeoutSec 30 -ErrorAction SilentlyContinue

$response