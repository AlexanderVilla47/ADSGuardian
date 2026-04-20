$headers = @{'X-N8N-API-KEY'='__REDACTED_N8N_API_KEY__'}
$body = Get-Content -Path "C:\Users\Usuario\Desktop\Proyectos\Automatizaciones\AdsKiller\update-workflow.json" -Raw

$response = Invoke-RestMethod -Uri 'http://168.138.125.21:5678/api/v1/workflows/rpnGFPo0nDthwzdB' -Headers $headers -Method PUT -Body $body -ContentType "application/json"
$response | ConvertTo-Json -Depth 10