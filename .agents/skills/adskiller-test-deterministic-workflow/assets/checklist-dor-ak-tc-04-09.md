# Checklist DoR - AK-TC-04..AK-TC-09

Regla: un caso solo pasa a ejecucion si TODO esta en check.

## AK-TC-04
- [ ] Inputs mock listos
- [ ] Condiciones iniciales verificadas
- [ ] PASS/FAIL definido

## AK-TC-05
- [ ] Inputs mock listos
- [ ] Condiciones iniciales verificadas
- [ ] PASS/FAIL definido

## AK-TC-06
- [ ] Inputs mock listos
- [ ] Condiciones iniciales verificadas
- [ ] PASS/FAIL definido

## AK-TC-07
- [ ] Inputs mock listos
- [ ] Condiciones iniciales verificadas
- [ ] PASS/FAIL definido

## AK-TC-08
- [ ] Inputs mock listos
- [ ] Condiciones iniciales verificadas
- [ ] PASS/FAIL definido

## AK-TC-09
- [ ] Inputs mock listos
- [ ] Condiciones iniciales verificadas
- [ ] PASS/FAIL definido

## Gate final antes de correr
- [ ] Preflight completo
- [ ] Plan prepare -> run one -> read evidence confirmado
- [ ] Evidencia minima definida (`execution_id`, nodos, campos clave)
- [ ] Nodo objetivo identificado y criterio de alcance definido
- [ ] Criterio de run valido definido (forcing + precondiciones medibles)
- [ ] Criterio de resultado definido (`PASS` | `FAIL` | `NO EJERCITADO` | `RUN INVALIDO`)

## Gate obligatorio de veredicto (post-ejecucion)
- [ ] Se evalua solo la ultima `execution_id` posterior al ultimo FIX/cambio
- [ ] La corrida evaluada es valida para el caso (si NO -> `RUN INVALIDO`)
- [ ] Nodo objetivo alcanzado en esa `execution_id` (si NO -> `NO EJERCITADO`)
- [ ] NO se mezcla evidencia de `execution_id` historicas

## Gate obligatorio de cierre (post-test)
- [ ] Caso actual en GREEN antes de avanzar al siguiente
- [ ] Cleanup tecnico aplicado (sin forcing residual)
- [ ] Cleanup de datos aplicado (Sheet/estado baseline)
- [ ] Evidencia de cleanup registrada
