# Plantilla - Reporte de resultado

## Identificacion
- Test Case ID: AK-TC-__
- Ejecucion: manual | scheduler | forced run
- Fecha/Hora (America/Argentina/Buenos_Aires):

## Resultado
- Decision final: PASS | FAIL | NO EJERCITADO | RUN INVALIDO
- Estado del ciclo: RED | FIX | GREEN
- Motivo resumido:

## Gate de validez de corrida
- Run valido para el caso (forcing + precondiciones cumplidas): SI | NO
- Si NO, decision obligatoria: RUN INVALIDO
- Criterio de run valido aplicado:

## Evidencia minima obligatoria
- execution_id evaluada (ultima post-cambio):
- Nodos ejecutados (nombre -> estado):
- Nodo objetivo alcanzado: SI | NO
- Campos clave validados:
  - input:
  - output:
  - estado final:

## Regla de validacion por ejecucion
- Ultimo FIX/cambio aplicado:
- Se valido SOLO con la ultima execution_id post-cambio: SI | NO
- Se mezclo evidencia historica para veredicto: NO (obligatorio)

## Validacion de criterio
- PASS definido como:
- FAIL definido como:
- NO EJERCITADO definido como: nodo objetivo no alcanzado en la execution_id evaluada
- RUN INVALIDO definido como: corrida sin forcing/gates minimos del caso
- Veredicto contra criterio:

## Accion siguiente
- [ ] Si FAIL: abrir FIX y re-ejecutar mismo caso
- [ ] Si GREEN: habilitar siguiente caso
- [ ] Si GREEN: apto para commit segun reglas

## Cleanup obligatorio post-test
- [ ] Cleanup tecnico aplicado (sin forcing residual)
- [ ] Cleanup de datos aplicado (Sheet/estado baseline)
- [ ] Evidencia de cleanup registrada

## Referencia de evidencia extensa
- test.json: ruta/indice del bloque relevante
