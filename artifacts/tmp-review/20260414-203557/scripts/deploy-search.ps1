$apiKey = "__REDACTED_N8N_API_KEY__"

$headers = @{"Content-Type" = "application/json"; "X-N8N-API-KEY" = $apiKey}

# GET workflow
Write-Host "Getting workflow..."
$wf = Invoke-RestMethod -Uri "http://168.138.125.21:5678/api/v1/workflows/cFBr6GavlSWDsUFz" -Method GET -Headers $headers

# Find the switch and count cases
$switch = $wf.nodes | Where-Object { $_.name -eq "Route Action" }
Write-Host "Switch rules: $($switch.parameters.rules.values.Count) cases"

# Add new nodes:
# 1. GS Read For Search (after Read Contratos)
$node1 = @{
    id = "search-read"
    name = "GS Read For Search"
    type = "n8n-nodes-base.googleSheets"
    typeVersion = 4.5
    position = @(-80, 200)
    parameters = @{
        authentication = "serviceAccount"
        documentId = @{__rl = $true; value = "1RKQ05Zy6beCwCr_mT95eVSgeOqQTAfTA_9kaYX1XJoY"; mode = "id"}
        sheetName = @{__rl = $true; value = "Contratos"; mode = "name"}
        options = @{returnAll = $true}
    }
    credentials = @{googleApi = @{}}
}

# 2. Filter Search Results (Code node)
$node2 = @{
    id = "search-filter"
    name = "Filter Search Results"
    type = "n8n-nodes-base.code"
    typeVersion = 2
    position = @(80, 200)
    parameters = @{
        jsCode = @"
const trigger = `$items('Validate Input', 0, 0)[0].json;
const query = String(trigger.q ?? '').toLowerCase();
const results = items.filter((item) => {
    const cliente = String(item.json.Cliente ?? '').toLowerCase();
    return cliente.includes(query);
});
return results;
"@
    }
}

# 3. Respond Search
$node3 = @{
    id = "search-respond"
    name = "Respond Search"
    type = "n8n-nodes-base.respondToWebhook"
    typeVersion = 1.1
    position = @(240, 200)
    parameters = @{
        respondWith = "json"
        responseBody = "={{ { ok: true, action: 'search', query: \$items('Validate Input',0,0)[0].json.q, total: \$items('Filter Search Results').length, data: \$items('Filter Search Results').map(i => i.json) } }}"
    }
}

# Add nodes to workflow
$wf.nodes += $node1
$wf.nodes += $node2
$wf.nodes += $node3

# Add connection from switch case for search to read node
# (Find which case is for search - should be case 1)
$wf.connections | Add-Member -NotePropertyName "Filter Search Results" -NotePropertyValue @{
    main = @(@(
        @{node = "Respond Search"}
    ))
}

$payload = @{name = $wf.name; nodes = $wf.nodes; connections = $wf.connections; settings = $wf.settings; staticData = $null}

Write-Host "Pushing workflow with search handler..."
try {
    $body = $payload | ConvertTo-Json -Depth 20
    $r = Invoke-RestMethod -Uri "http://168.138.125.21:5678/api/v1/workflows/cFBr6GavlSWDsUFz" -Method PUT -Headers $headers -Body $body -TimeoutSec 60
    Write-Host "SUCCESS! Search handler deployed"
} catch {
    Write-Host "ERROR: $($_.Exception.Message)"
}