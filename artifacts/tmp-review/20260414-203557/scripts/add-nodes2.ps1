$apiKey = "__REDACTED_N8N_API_KEY__"

$headers = @{"Content-Type" = "application/json"; "X-N8N-API-KEY" = $apiKey}
$wf = Invoke-RestMethod -Uri "http://168.138.125.21:5678/api/v1/workflows/cFBr6GavlSWDsUFz" -Method GET -Headers $headers

# Add 3 nodes - use array concatenation
$n1 = @{
    id = "GS_Read_For_Search"
    name = "GS Read For Search"
    type = "n8n-nodes-base.googleSheets"
    typeVersion = 4.5
    position = @(100, 180)
    parameters = @{
        authentication = "serviceAccount"
        operation = "read"
        documentId = @{__rl = $true; value = "1RKQ05Zy6beCwCr_mT95eVSgeOqQTAfTA_9kaYX1XJoY"; mode = "id"}
        sheetName = @{__rl = $true; value = "Contratos"; mode = "name"}
        options = @{returnAll = $true}
    }
    credentials = @{googleApi = @{}}
$n2 = @{
    id = "Filter_Search_Results"
    name = "Filter Search Results"
    type = "n8n-nodes-base.code"
    typeVersion = 2
    position = @(260, 180)
    parameters = @{
        jsCode = "const trigger = `$items('Validate Input', 0, 0)[0].json; const query = String(trigger.q ?? '').toLowerCase(); const results = items.filter((item) => { const cliente = String(item.json.Cliente ?? '').toLowerCase(); return cliente.includes(query); }); return results;"
    }
}
$n3 = @{
    id = "Respond_Search"
    name = "Respond Search"
    type = "n8n-nodes-base.respondToWebhook"
    typeVersion = 1.1
    position = @(420, 180)
    parameters = @{
        respondWith = "json"
        responseBody = "={{ { ok: true, action: 'search', query: `$items('Validate Input',0,0)[0].json.q, total: `$items('Filter Search Results').length, data: `$items('Filter Search Results').map(i => i.json) } }}"
    }
}

# Add to nodes array
$nodesList = @($wf.nodes)
$nodesList += $n1
$nodesList += $n2
$nodesList += $n3
$wf.nodes = $nodesList

Write-Host "Added 3 nodes"

# Push
$payload = @{name = $wf.name; nodes = $wf.nodes; connections = $wf.connections; settings = $wf.settings; staticData = $null}
$body = $payload | ConvertTo-Json -Depth 15
Write-Host "Pushing..."
try {
    $r = Invoke-RestMethod -Uri "http://168.138.125.21:5678/api/v1/workflows/cFBr6GavlSWDsUFz" -Method PUT -Headers $headers -Body $body -TimeoutSec 60
    Write-Host "SUCCESS!"
} catch {
    Write-Host "ERROR: $($_.Exception.Message)"
}