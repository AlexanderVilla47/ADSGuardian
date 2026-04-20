---
name: adskiller-test-deterministic-workflow
description: Estandariza SIEMPRE la ejecucion deterministica de tests en AdsKiller para workflows n8n con protocolo fijo DoR, preflight, ejecucion por pasos cortos, PASS/FAIL explicito, ciclo RED->FIX->GREEN, evidencia minima y reglas de commit. Trigger: usar antes de correr o validar cualquier test de workflow en AdsKiller.
license: Apache-2.0
metadata:
  author: gentleman-programming
  version: "1.0.0"
---

# AdsKiller Deterministic Workflow Testing

## Proposito

Forzar una metodologia unica y repetible para ejecutar tests de workflows en AdsKiller sin ambiguedad operativa.

Resultado esperado:
- cada test corre con precondiciones claras,
- la evidencia es auditable,
- el avance de casos se frena automaticamente ante fallos.

## Cuando usar

Usa esta skill SIEMPRE cuando:
- se ejecuta un test manual o semiautomatico de workflows AdsKiller,
- se valida AK-TC-04..AK-TC-09,
- se verifica un fix previo a cerrar un caso,
- se prepara evidencia para QA/operacion/auditoria.

## Que NO hacer

- NO correr lotes de tests sin evidencia por caso.
- NO saltar DoR ni preflight.
- NO marcar PASS sin campos clave comprobables.
- NO avanzar al siguiente test si el actual esta en RED.
- NO hacer commit de test fallido o sin criterio explicito.

## Protocolo fijo obligatorio por test

### 1) Definition of Ready (DoR)

Antes de ejecutar, confirmar:
1. Inputs mock definidos (payload, credenciales mock, IDs).
2. Planilla/caso objetivo identificado (AK-TC-xx).
3. Condiciones iniciales trazables (estado esperado previo).
4. Resultado esperado documentado con criterio binario.

Si falta cualquiera de los cuatro puntos, el test NO inicia.

### 2) Preflight de condiciones

Checklist minimo:
1. Entorno correcto (timezone America/Argentina/Buenos_Aires).
2. Datos de prueba cargados y versionados.
3. Dependencias externas desacopladas o mockeadas.
4. Regla de idempotencia definida para reintentos.

Si preflight falla, registrar bloqueo y volver a DoR.

### 3) Ejecucion en pasos cortos

Secuencia fija:
1. `prepare`: preparar input y estado inicial.
2. `run one`: ejecutar una sola corrida controlada.
3. `read evidence`: leer evidencia minima y comparar.

No se permite `run many` hasta tener GREEN del caso actual.

## Procedimiento validado en campo

Secuencia operativa corta y obligatoria:
1. `Prepare`: validar DoR, aislar caso objetivo, fijar forcing mock del caso y confirmar criterio de run valido.
2. `Run One`: ejecutar una sola corrida controlada y capturar `execution_id`.
3. `Read Evidence`: evaluar solo la ultima `execution_id` post-fix y emitir veredicto deterministico.
4. `Cleanup`: restaurar baseline y dejar evidencia de limpieza antes de cerrar el caso.

Reglas de aplicacion:
- Gate DoR de datos (Sheet): no se corre si la fila/caso no esta identificado y con estado inicial verificable.
- Gate de forcing mock: la corrida es valida solo si los forcing esperados del caso fueron realmente aplicados.
- Regla de veredicto por ultima ejecucion: la decision se toma unicamente con la ultima `execution_id` posterior al ultimo FIX/cambio.
- Estados oficiales permitidos: `PASS`, `FAIL`, `NO EJERCITADO`, `RUN INVALIDO`.
- No avanzar de caso: si el caso actual no queda en `GREEN`, el siguiente caso NO inicia.
- Cleanup obligatorio: tras cada test se restaura configuracion/estado baseline y se registra evidencia de cleanup.

### 4) Criterio PASS/FAIL/NO EJERCITADO/RUN INVALIDO explicito

Todo test debe declarar:
- condicion de PASS (valores exactos/estados exactos),
- condicion de FAIL (desviacion puntual),
- condicion de `NO EJERCITADO` cuando no se alcanza el nodo objetivo,
- condicion de `RUN INVALIDO` cuando la corrida no cumple forcing/gates requeridos del caso,
- decision final (`PASS`, `FAIL`, `NO EJERCITADO` o `RUN INVALIDO`) sin estados ambiguos.

Gate obligatorio de veredicto:
- si el nodo objetivo no fue alcanzado en la corrida evaluada, el estado final ES `NO EJERCITADO`;
- si la corrida no cumple forcing/gates del caso, el estado final ES `RUN INVALIDO`;
- en esos escenarios no se permite etiquetar `PASS` ni `FAIL`.

### 5) Ciclo RED -> FIX -> GREEN

Regla estricta:
1. Si da FAIL -> estado `RED`.
2. Aplicar correccion puntual -> `FIX`.
3. Re-ejecutar el mismo caso -> `GREEN`.
4. Recien en GREEN se habilita el siguiente test.

### 6) Cleanup obligatorio post-test

Al terminar cada caso (PASS/FAIL/NO EJERCITADO/RUN INVALIDO):
1. Restaurar baseline tecnico (sin forcing residual en nodos/configuracion).
2. Restaurar baseline de datos de prueba (Sheet/estado de control del caso).
3. Registrar evidencia de cleanup con referencia trazable (`execution_id` o evidencia operativa equivalente).

Sin cleanup confirmado, el caso no puede considerarse cerrado.

## Evidencia minima obligatoria

Cada test debe guardar como minimo:
- `execution_id`
- nodos ejecutados (nombres + estado)
- campos clave del caso (entrada/salida relevante)

Formato recomendado: consolidar detalle extenso en `test.json` y adjuntar reporte corto por caso.

## Regla estricta de validacion por ejecucion

Para emitir veredicto oficial del caso:
1. Validar solo contra la ultima `execution_id` posterior al ultimo FIX/cambio aplicado al caso.
2. No mezclar evidencia de `execution_id` historicas para construir el veredicto.
3. Si la ultima `execution_id` post-cambio no alcanza el nodo objetivo, el resultado obligatorio es `NO EJERCITADO`.

## Reglas de commit por test exitoso

Solo se permite commit cuando:
1. El caso quedo en GREEN.
2. Existe evidencia minima completa.
3. El reporte incluye PASS/FAIL explicito y decision final.

Reglas:
- un commit por bloque coherente de casos en GREEN,
- nunca mezclar casos RED con GREEN en el mismo commit,
- mensaje de commit indicando alcance de casos validados.

## Plantillas listas para usar

- Antes de correr: `assets/antes-de-correr.md`
- Reporte de resultado: `assets/reporte-resultado.md`
- Checklist DoR AK-TC-04..09: `assets/checklist-dor-ak-tc-04-09.md`

## Criterios de salida

La ejecucion deterministica queda completa cuando:
- DoR y preflight estan completos,
- cada caso tiene decision PASS/FAIL/NO EJERCITADO/RUN INVALIDO,
- todo FAIL recorrio RED->FIX->GREEN,
- todo veredicto usa solo la ultima `execution_id` post-cambio,
- no se mezcla evidencia historica para cerrar el caso,
- evidencia minima esta registrada y trazable,
- cleanup post-test esta ejecutado y evidenciado,
- se respeta politica de commit por casos exitosos.

## Integracion con otras skills

- `n8n-workflow-testing`: cobertura funcional/no funcional de suite.
- `n8n-observability`: calidad de trazas y correlacion.
- `n8n-api-http-robusta`: validacion de retries/rate-limit/idempotencia.
