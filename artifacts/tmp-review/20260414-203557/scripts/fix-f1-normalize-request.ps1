$headers = @{
    'X-N8N-API-KEY' = '__REDACTED_N8N_API_KEY__'
}
$workflow = Invoke-RestMethod -Uri 'http://168.138.125.21:5678/api/v1/workflows/rpnGFPo0nDthwzdB' -Headers $headers

$cleanSettings = @{
    executionOrder = "v1"
    callerPolicy = "workflowsFromSameOwner"
}

$workflow.nodes | ForEach-Object {
    if ($_.name -eq 'Normalize Request') {
        $_.parameters.jsCode = @"
const payload = `$json.body ?? `$json;
const action = String(payload.action ?? '').trim().toLowerCase();
const timezone = 'America/Argentina/Buenos_Aires';

function nowDateInTZ(tz) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return fmt.format(new Date());
}

return [
  {
    json: {
      ...payload,
      action,
      timezone,
      request_ts: new Date().toISOString(),
      today_tz: nowDateInTZ(timezone),
    },
  }
];
"@
    }
}

$payload = @{
    name = $workflow.name
    nodes = $workflow.nodes
    connections = $workflow.connections
    settings = $cleanSettings
}

$jsonPayload = $payload | ConvertTo-Json -Depth 20
$utf8Bytes = [System.Text.Encoding]::UTF8.GetBytes($jsonPayload)
$response = Invoke-RestMethod -Uri 'http://168.138.125.21:5678/api/v1/workflows/rpnGFPo0nDthwzdB' -Headers $headers -Method PUT -Body $utf8Bytes -ContentType 'application/json'
$response | ConvertTo-Json -Depth 10