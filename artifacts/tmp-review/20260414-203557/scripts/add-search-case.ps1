$apiKey = "__REDACTED_N8N_API_KEY__"

$headers = @{"Content-Type" = "application/json"; "X-N8N-API-KEY" = $apiKey}
$wf = Invoke-RestMethod -Uri "http://168.138.125.21:5678/api/v1/workflows/cFBr6GavlSWDsUFz" -Method GET -Headers $headers

# Find the switch node
$sw = $wf.nodes | Where-Object { $_.name -eq "Route Action" }
$rules = $sw.parameters.rules

# The Switch has 10 cases. Need to add case for 'search' = case 1 (after alta)
# Add condition for search
$searchRule = @{value1="{{ \$json.action }}"; operation = "equal"; value2 = "search"; options = @{}}

# Insert at position 1 (after alta which is position 0)
$rules.values[1].conditions = $searchRule

$sw.parameters.rules = $rules

# Add connection - need to add output from switch case 1 to the search handler
# First create search handler node if it doesn't exist, or find existing

$payload = @{name = $wf.name; nodes = $wf.nodes; connections = $wf.connections; settings = $wf.settings; staticData = $null}
$body = $payload | ConvertTo-Json -Depth 15
try {
    $r = Invoke-RestMethod -Uri "http://168.138.125.21:5678/api/v1/workflows/cFBr6GavlSWDsUFz" -Method PUT -Headers $headers -Body $body -TimeoutSec 60
    Write-Host "Added case for search!"
} catch {
    Write-Host "NOTE: $($_.Exception.Message)"
    # The issue might be the connection - add connection manually
}