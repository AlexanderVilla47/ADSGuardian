# front-operational-console Specification

## Purpose

Definir comportamiento funcional minimo para que la UI MVP opere AdsKiller con riesgo controlado usando F1/F2/F3 y persistencia en Google Sheets.

## Requirements

### Requirement: Contrato unico de acciones MVP

El sistema MUST exponer un contrato API estable para acciones de UI (`alta`, `consulta`, `extension`, `run_now`, `listar_ads`, `pause_ad`, `baja_manual`, `operational_history`) sin depender de estructura interna de nodos n8n.

#### Scenario: Accion soportada y respuesta estable

- GIVEN una solicitud valida con `action` soportada y payload valido
- WHEN el backend procesa la accion
- THEN responde con DTO versionado y `correlation_id`

#### Scenario: Accion no soportada

- GIVEN una solicitud con `action` fuera del contrato
- WHEN el backend valida entrada
- THEN responde error 4xx con codigo y mensaje accionable

### Requirement: Operacion de pausa manual segura por Ad

El sistema SHALL permitir `pause_ad` manual por `Contrato_ID` y `Ad_ID`, y MUST ejecutar pre-check de estado `ACTIVE` antes de pausar en Meta.

#### Scenario: Pausa valida

- GIVEN un Ad en estado `ACTIVE` y contrato vigente
- WHEN se ejecuta `pause_ad`
- THEN el Ad se pausa y el resultado queda auditado

#### Scenario: Ad no activo

- GIVEN un Ad en estado distinto de `ACTIVE`
- WHEN se ejecuta `pause_ad`
- THEN no se intenta pausar y se informa rechazo operativo

### Requirement: Historial operativo consultable

El sistema MUST persistir eventos de ejecucion y alerting en Google Sheets para consulta paginada desde `Operational History`.

#### Scenario: Consulta por periodo

- GIVEN eventos existentes en el rango solicitado
- WHEN la UI consulta historial
- THEN recibe filas con `execution_id`, `trigger_type`, `result`, metricas y errores

#### Scenario: Ultima ejecucion no ejercitada

- GIVEN que la ultima ejecucion posterior al ultimo fix no llega al nodo objetivo
- WHEN se calcula resultado operativo
- THEN se marca estado `NOT EXERCISED`

### Requirement: Validaciones de dominio no negociables

El sistema MUST aplicar reglas de dominio: fechas `YYYY-MM-DD`, timezone `America/Argentina/Buenos_Aires`, pausa solo a nivel Ad y retries Meta `429/500` de 3 intentos con espera de 5 minutos.

#### Scenario: Fecha invalida

- GIVEN una fecha fuera de formato `YYYY-MM-DD`
- WHEN se intenta crear o extender contrato
- THEN la solicitud se rechaza con error de validacion

#### Scenario: Error transitorio Meta

- GIVEN respuesta Meta `429` o `500`
- WHEN se ejecuta operacion de pausa
- THEN el sistema reintenta hasta 3 veces con espera de 5 minutos
