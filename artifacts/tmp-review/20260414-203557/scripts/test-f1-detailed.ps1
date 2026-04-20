$body = @{
    action = "alta"
    Contrato_ID = "CTR-7777"
    Cliente = "Test Debug"
    Regex_Anuncio = "debug"
    Fecha_Fin = "2026-04-28"
} | ConvertTo-Json

$utf8Bytes = [System.Text.Encoding]::UTF8.GetBytes($body)

try {
    $response = Invoke-WebRequest -Uri 'http://168.138.125.21:5678/webhook/contract-ui-management' -Method POST -Body $utf8Bytes -ContentType 'application/json' -TimeoutSec 60
    Write-Host "Status Code: $($response.StatusCode)"
    Write-Host "Content: $($response.Content)"
} catch {
    Write-Host "Exception: $($_.Exception.GetType().FullName)"
    Write-Host "Message: $($_.Exception.Message)"
    if ($_.Exception.Response) {
        Write-Host "Response Status: $($_.Exception.Response.StatusCode)"
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $reader.BaseStream.Position = 0
        $responseBody = $reader.ReadToEnd()
        $reader.Close()
        Write-Host "Response Body: $responseBody"
    }
}