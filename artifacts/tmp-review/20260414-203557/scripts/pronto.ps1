$apiKey = "__REDACTED_N8N_API_KEY__"

$headers = @{"Content-Type" = "application/json"; "X-N8N-API-KEY" = $apiKey}
$wf = Invoke-RestMethod -Uri "http://168.138.125.21:5678/api/v1/workflows/cFBr6GavlSWDsUFz" -Method GET -Headers $headers

# Add 3 nodes
$g1 = @{
    id = "search1"
    name = "GS Search"
    type = "n8n-nodes-base.googleSheets"
    typeVersion = 4.5
    position = @(100, 200)
    parameters = @{
        authentication = "serviceAccount"
        operation = "read"
        documentId = @{__rl = $true; value = "1RKQ05Zy6beCwCr_mT95eVSgeOqQTAfTA_9kaYX1XJoY"; mode = "id"}
        sheetName = @{__rl = $true; value = "Contratos"; mode = "name"}
    }
    credentials = @{googleApi = @{}}
$g2 = @{
    id = "search2"
    name = "Filter Search"
    type = "n8n-nodes-base.code"
    typeVersion = 2
    position = @(260, 200)
    parameters = @{jsCode = "const q=`$items('Validate Input',0,0)[0].json.q;return items.filter(i=>i.json.Cliente.toLowerCase().includes(q.toLowerCase()));"}
}
$g3 = @{
    id = "search3"
    name = "Respond Search"
    type = "n8n-nodes-base.respondToWebhook"
    typeVersion = 1.1
    position = @(420, 200)
    parameters = @{respondWith="json";responseBody="={{{ok:true,action:'search',total:`$items('Filter Search').length,data:`$items('Filter Search').map(i=>i.json)}}}"}
}

$nodes = @($wf.nodes)
$nodes += $g1
$nodes += $g2
$nodes += $g3
$wf.nodes = $nodes

$payload = @{
    name = $wf.name
    nodes = $wf.nodes
    connections = $wf.connections
    settings = $wf.settings
    staticData = $null
}

$body = $payload | ConvertTo-Json -Depth 15
$r = Invoke-RestMethod -Uri "http://168.138.125.21:5678/api/v1/workflows/cFBr6GavlSWDsUFz" -Method PUT -Headers $headers -Body $body -TimeoutSec 60

Write-Host "SUCCESS!"