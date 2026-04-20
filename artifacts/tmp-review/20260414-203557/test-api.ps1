$ErrorActionPreference = 'SilentlyContinue'
$key = [System.Environment]::GetEnvironmentVariable('N8N_API_KEY', 'Process')
if ([string]::IsNullOrEmpty($key)) {
    Write-Host "N8N_API_KEY not found in environment"
    exit 1
}
$headers = @{ "X-N8N-API-KEY" = $key }
try {
    $r = Invoke-WebRequest -Method GET -Uri "http://168.138.125.21:5678/api/v1/workflows/cFBr6GavlSWDsUFz" -Headers $headers
    Write-Host "Status: $($r.StatusCode)"
    Write-Host "Has content: $($r.Content.Length)"
} catch {
    Write-Host "Error: $($_.Exception.Message)"
    if ($_.Exception.Response) {
        Write-Host "Status Code: $($_.Exception.Response.StatusCode)"
    }
}
