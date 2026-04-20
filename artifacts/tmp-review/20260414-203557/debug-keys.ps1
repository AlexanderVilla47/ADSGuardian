$headers = @{'X-N8N-API-KEY'='__REDACTED_N8N_API_KEY__'}

# Get current workflow to extract exact properties
$workflow = Invoke-RestMethod -Uri 'http://168.138.125.21:5678/api/v1/workflows/rpnGFPo0nDthwzdB' -Headers $headers

# Show what keys are in the workflow (to debug)
$workflow.PSObject.Properties.Name