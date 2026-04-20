param(
  [string]$ApiBaseUrl = $(if ($env:N8N_API_BASE_URL) { $env:N8N_API_BASE_URL } else { "http://168.138.125.21:5678/api/v1" }),
  [string]$WebhookUrl = $(if ($env:N8N_FLOW3_WEBHOOK_URL) { $env:N8N_FLOW3_WEBHOOK_URL } else { "http://168.138.125.21:5678/webhook/ops-reporting-alerts" }),
  [string]$WorkflowId = $(if ($env:N8N_FLOW3_WORKFLOW_ID) { $env:N8N_FLOW3_WORKFLOW_ID } else { "BFHHQwYFfmcpqshb" }),
  [int]$ExecutionLookupLimit = $(if ($env:N8N_FLOW3_LOOKUP_LIMIT) { [int]$env:N8N_FLOW3_LOOKUP_LIMIT } else { 30 }),
  [int]$PollAttempts = $(if ($env:N8N_FLOW3_POLL_ATTEMPTS) { [int]$env:N8N_FLOW3_POLL_ATTEMPTS } else { 20 }),
  [int]$PollIntervalSeconds = $(if ($env:N8N_FLOW3_POLL_INTERVAL_SECONDS) { [int]$env:N8N_FLOW3_POLL_INTERVAL_SECONDS } else { 2 })
)

$ErrorActionPreference = "Stop"

if (-not $env:N8N_API_KEY) {
  Write-Error "Falta N8N_API_KEY en variables de entorno."
  exit 2
}

if ($env:N8N_MCP_TOKEN) {
  Write-Host "[info] N8N_MCP_TOKEN detectado (legacy/deprecado para Flow3); se ignora y se usa N8N_API_KEY con X-N8N-API-KEY."
}

$SlackWebhookUrl = if ($env:N8N_FLOW3_SLACK_WEBHOOK_URL) { $env:N8N_FLOW3_SLACK_WEBHOOK_URL } else { "https://example.invalid/flow3-smoke" }
$TelegramBotToken = if ($env:N8N_FLOW3_TELEGRAM_BOT_TOKEN) { $env:N8N_FLOW3_TELEGRAM_BOT_TOKEN } else { "000000:invalid" }
$TelegramChatId = if ($env:N8N_FLOW3_TELEGRAM_CHAT_ID) { $env:N8N_FLOW3_TELEGRAM_CHAT_ID } else { "0" }

$headers = @{ "X-N8N-API-KEY" = $env:N8N_API_KEY }

function Invoke-N8nApi {
  param(
    [string]$Method,
    [string]$Path
  )

  $uri = "{0}/{1}" -f $ApiBaseUrl.TrimEnd('/'), $Path.TrimStart('/')
  return Invoke-RestMethod -Method $Method -Uri $uri -Headers $headers
}

function Get-NodeRuns {
  param(
    [object]$Execution,
    [string]$NodeName
  )

  $runData = $Execution.data.resultData.runData
  if ($null -eq $runData) { return @() }

  $prop = $runData.PSObject.Properties | Where-Object { $_.Name -eq $NodeName } | Select-Object -First 1
  if ($null -eq $prop) { return @() }

  $runs = @()
  if ($prop.Value -is [System.Array]) {
    $runs = @($prop.Value)
  } elseif ($null -ne $prop.Value) {
    $runs = @($prop.Value)
  }

  return ,$runs
}

function Get-LastNodeJson {
  param(
    [object]$Execution,
    [string]$NodeName
  )

  $runs = Get-NodeRuns -Execution $Execution -NodeName $NodeName
  if ($runs.Count -eq 0) { return $null }

  $lastRun = $runs[$runs.Count - 1]
  if ($null -eq $lastRun.data -or $null -eq $lastRun.data.main) { return $null }

  foreach ($branch in $lastRun.data.main) {
    if ($null -eq $branch) { continue }
    foreach ($item in $branch) {
      if ($null -ne $item.json) {
        return $item.json
      }
    }
  }

  return $null
}

function Get-NodeJsonItems {
  param(
    [object]$Execution,
    [string]$NodeName
  )

  $runs = Get-NodeRuns -Execution $Execution -NodeName $NodeName
  if ($runs.Count -eq 0) { return @() }

  $items = @()
  foreach ($run in $runs) {
    if ($null -eq $run.data -or $null -eq $run.data.main) { continue }
    foreach ($branch in $run.data.main) {
      if ($null -eq $branch) { continue }
      foreach ($item in $branch) {
        if ($null -ne $item.json) {
          $items += $item.json
        }
      }
    }
  }

  return @($items)
}

function Get-RunData {
  param([object]$Execution)

  if ($null -eq $Execution -or $null -eq $Execution.data -or $null -eq $Execution.data.resultData) {
    return $null
  }

  return $Execution.data.resultData.runData
}

function Get-NodeNames {
  param([object]$Execution)

  $runData = Get-RunData -Execution $Execution
  if ($null -eq $runData) { return @() }
  return @($runData.PSObject.Properties.Name)
}

function Test-NodeRunByPattern {
  param(
    [object]$Execution,
    [string]$NodeNameRegex
  )

  foreach ($nodeName in (Get-NodeNames -Execution $Execution)) {
    if ($nodeName -notmatch $NodeNameRegex) { continue }
    if ((Get-NodeRuns -Execution $Execution -NodeName $nodeName).Count -gt 0) {
      return $true
    }
  }

  return $false
}

function Get-AllJsonItems {
  param([object]$Execution)

  $items = @()
  foreach ($nodeName in (Get-NodeNames -Execution $Execution)) {
    $items += Get-NodeJsonItems -Execution $Execution -NodeName $nodeName
  }
  return @($items)
}

function Find-EventItems {
  param(
    [object]$Execution,
    [string]$EventName,
    [string[]]$Channels
  )

  $filtered = @((Get-AllJsonItems -Execution $Execution) | Where-Object {
    $event = [string]$_.event
    if ($event -ne $EventName) { return $false }

    if ($null -eq $Channels -or $Channels.Count -eq 0) {
      return $true
    }

    $channel = [string]$_.channel
    return ($Channels -contains $channel.ToLowerInvariant())
  })

  return $filtered
}

function Get-CorrelationFromExecution {
  param([object]$Execution)

  $normalized = Get-LastNodeJson -Execution $Execution -NodeName "Normalize Payload"
  if ($null -ne $normalized -and $normalized.correlation_id) {
    return [string]$normalized.correlation_id
  }

  $webhook = Get-LastNodeJson -Execution $Execution -NodeName "KillSwitch Result Webhook"
  if ($null -ne $webhook -and $webhook.body -and $webhook.body.correlation_id) {
    return [string]$webhook.body.correlation_id
  }

  return $null
}

function Find-ExecutionByCorrelation {
  param(
    [string]$CorrelationId,
    [datetime]$StartUtc
  )

  for ($attempt = 1; $attempt -le $PollAttempts; $attempt++) {
    $query = "executions?workflowId={0}&limit={1}" -f $WorkflowId, $ExecutionLookupLimit
    $list = Invoke-N8nApi -Method "GET" -Path $query

    foreach ($executionSummary in $list.data) {
      if (-not $executionSummary.id) { continue }

      $detail = Invoke-N8nApi -Method "GET" -Path ("executions/{0}?includeData=true" -f $executionSummary.id)
      $startedAt = [datetime]::Parse($detail.startedAt).ToUniversalTime()
      if ($startedAt -lt $StartUtc.AddMinutes(-1)) { continue }

      $foundCorrelation = Get-CorrelationFromExecution -Execution $detail
      if ($foundCorrelation -eq $CorrelationId) {
        return $detail
      }
    }

    Start-Sleep -Seconds $PollIntervalSeconds
  }

  return $null
}

function Validate-Case {
  param(
    [string]$CaseName,
    [object]$Execution,
    [string]$ExpectedUnsupportedChannel
  )

  $hasSlackSend = Test-NodeRunByPattern -Execution $Execution -NodeNameRegex '^Send Slack Notification($|\s|\(|-)'
  $hasTelegramSend = Test-NodeRunByPattern -Execution $Execution -NodeNameRegex '^Send Telegram Notification($|\s|\(|-)'
  $hasUnsupportedNode = Test-NodeRunByPattern -Execution $Execution -NodeNameRegex '^Log Unsupported Channel($|\s|\(|-)'

  $slackSentItems = Find-EventItems -Execution $Execution -EventName "ops_notification_sent" -Channels @("slack")
  $telegramSentItems = Find-EventItems -Execution $Execution -EventName "ops_notification_sent" -Channels @("telegram")
  $slackErrorItems = Find-EventItems -Execution $Execution -EventName "ops_notification_channel_error" -Channels @("slack", "both")
  $telegramErrorItems = Find-EventItems -Execution $Execution -EventName "ops_notification_channel_error" -Channels @("telegram", "both")
  $unsupportedItems = Find-EventItems -Execution $Execution -EventName "ops_notification_channel_unsupported" -Channels @()

  $hasUnsupported = ($hasUnsupportedNode -or $unsupportedItems.Count -gt 0)
  $hasSupportedChannelEvidence = (
    $hasSlackSend -or
    $hasTelegramSend -or
    $slackSentItems.Count -gt 0 -or
    $telegramSentItems.Count -gt 0 -or
    $slackErrorItems.Count -gt 0 -or
    $telegramErrorItems.Count -gt 0
  )

  $unsupported = if ($unsupportedItems.Count -gt 0) { $unsupportedItems[$unsupportedItems.Count - 1] } else { $null }

  $checks = @()

  switch ($CaseName) {
    "telegram" {
      $checks += @{ ok = -not $hasUnsupported; message = "no cae en unsupported" }
      $checks += @{
        ok = (
          $hasTelegramSend -or
          ($telegramSentItems.Count -gt 0) -or
          ($telegramErrorItems.Count -gt 0)
        )
        message = "evidencia de envio/intent para telegram"
      }
    }
    "slack" {
      $checks += @{ ok = -not $hasUnsupported; message = "no cae en unsupported" }
      $checks += @{
        ok = (
          $hasSlackSend -or
          ($slackSentItems.Count -gt 0) -or
          ($slackErrorItems.Count -gt 0)
        )
        message = "evidencia de envio/intent para slack"
      }
    }
    "both" {
      $checks += @{ ok = -not $hasUnsupported; message = "both no debe caer en unsupported" }
      $checks += @{
        ok = (
          $hasSlackSend -or
          ($slackSentItems.Count -gt 0) -or
          ($slackErrorItems.Count -gt 0)
        )
        message = "both evidencia envio/intent por slack"
      }
      $checks += @{
        ok = (
          $hasTelegramSend -or
          ($telegramSentItems.Count -gt 0) -or
          ($telegramErrorItems.Count -gt 0)
        )
        message = "both evidencia envio/intent por telegram"
      }
    }
    "unsupported" {
      $checks += @{ ok = $hasUnsupported; message = "ejecuta Log Unsupported Channel" }
      $checks += @{
        ok = (
          $null -eq $unsupported -or
          [string]$unsupported.event -eq "ops_notification_channel_unsupported"
        )
        message = "log event unsupported"
      }
      $checks += @{
        ok = (
          $null -eq $unsupported -or
          [string]$unsupported.channel -eq $ExpectedUnsupportedChannel
        )
        message = ("canal unsupported={0}" -f $ExpectedUnsupportedChannel)
      }
      $checks += @{ ok = -not $hasSupportedChannelEvidence; message = "unsupported no envia por canales soportados" }
    }
    default {
      $checks += @{ ok = $false; message = "caso no reconocido" }
    }
  }

  $failedChecks = @($checks | Where-Object { -not $_.ok })
  if ($failedChecks.Count -eq 0) {
    return @{ pass = $true; details = "OK" }
  }

  $details = ($failedChecks | ForEach-Object { $_.message }) -join "; "
  return @{ pass = $false; details = $details }
}

Write-Host "[1/3] Preflight API"
Invoke-RestMethod -Method "GET" -Uri (("{0}/healthz" -f $ApiBaseUrl.Replace('/api/v1', '').TrimEnd('/'))) | Out-Null
Invoke-N8nApi -Method "GET" -Path ("workflows/{0}" -f $WorkflowId) | Out-Null
Invoke-N8nApi -Method "GET" -Path ("executions?workflowId={0}&limit=1" -f $WorkflowId) | Out-Null

$testCases = @(
  @{ name = "telegram"; channel = "telegram"; unsupportedChannel = $null },
  @{ name = "slack"; channel = "slack"; unsupportedChannel = $null },
  @{ name = "both"; channel = "both"; unsupportedChannel = "both" },
  @{ name = "unsupported"; channel = "email"; unsupportedChannel = "email" }
)

$results = @()

Write-Host "[2/3] Ejecutando 4 casos smoke"
foreach ($case in $testCases) {
  $suffix = [Guid]::NewGuid().ToString("N").Substring(0, 8)
  $correlationId = "flow3-smoke-{0}-{1}" -f $case.name, $suffix
  $executionId = "flow3-smoke-{0}-{1}" -f $case.name, (Get-Date -Format "yyyyMMddHHmmss")
  $startUtc = (Get-Date).ToUniversalTime()

  $payload = @{
    execution_id = $executionId
    correlation_id = $correlationId
    execution_mode = "manual"
    executed_at = (Get-Date).ToUniversalTime().ToString("o")
    timezone = "America/Argentina/Buenos_Aires"
    execution_status = "error"
    metrics = @{
      contracts_evaluated = 2
      ads_evaluated = 4
      paused_success_count = 1
      paused_error_count = 1
      expired_unpaused_count = 0
      preventive_48h_count = 1
      duration_ms = 1500
    }
    incidents = @(
      @{ code = "SMOKE_CASE"; message = ("Smoke test case {0}" -f $case.name) }
    )
    notification = @{
      channel = $case.channel
      slack = @{ webhook_url = $SlackWebhookUrl }
      telegram = @{ bot_token = $TelegramBotToken; chat_id = $TelegramChatId }
    }
  }

  $result = [ordered]@{
    Case = $case.name
    CorrelationId = $correlationId
    ExecutionId = "N/A"
    StartedAt = "N/A"
    StoppedAt = "N/A"
    Status = "FAIL"
    Details = "sin validar"
  }

  try {
    Invoke-RestMethod -Method "POST" -Uri $WebhookUrl -ContentType "application/json" -Body ($payload | ConvertTo-Json -Depth 20) | Out-Null

    $execution = Find-ExecutionByCorrelation -CorrelationId $correlationId -StartUtc $startUtc
    if ($null -eq $execution) {
      $result.Details = "no se encontro execution por correlacion"
    } else {
      $result.ExecutionId = [string]$execution.id
      $result.StartedAt = [string]$execution.startedAt
      $result.StoppedAt = [string]$execution.stoppedAt

      $validation = Validate-Case -CaseName $case.name -Execution $execution -ExpectedUnsupportedChannel $case.unsupportedChannel
      if ($validation.pass) {
        $result.Status = "PASS"
        $result.Details = "asserts minimos OK"
      } else {
        $result.Details = $validation.details
      }
    }
  } catch {
    $result.Details = "error: $($_.Exception.Message)"
  }

  $results += [PSCustomObject]$result
}

Write-Host "[3/3] Resultado final"
$results | Format-Table Case, ExecutionId, Status, Details -AutoSize

$failed = @($results | Where-Object { $_.Status -ne "PASS" })
if ($failed.Count -gt 0) {
  Write-Error ("Smoke regression FAIL: {0} de {1} casos fallaron." -f $failed.Count, $results.Count)
  exit 1
}

Write-Host "Smoke regression GREEN (4/4)."
exit 0
