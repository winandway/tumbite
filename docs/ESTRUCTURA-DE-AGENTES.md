# Estructura de agentes de Windoce

Creada el 1 de noviembre de 2026 a pedido de Richard. Sirve para todas las empresas y apps
(Divoox, YaDominios, QRBott y las que vengan), no solo para Divoox.

## La idea en una frase

Un jefe que reparte el trabajo y especialistas con una sola responsabilidad cada uno. No
conversan libremente: se pasan el trabajo por escrito, como una empresa que trabaja con tickets.

```
                         RICHARD
              (dinero, legal, cuentas, borrar)
                            │
                   JEFE DE OPERACIONES
          (ordena la fila y asigna; no programa)
                            │
 ┌───────────┬──────────────┼──────────────┬─────────────┬────────────┐
INVESTIGADOR DESARROLLADOR REVISOR CALIDAD GUARDIA PROD.  TIENDAS     TESORERO
 estudia     construye     aprueba o      vigila y       Google Play  mira el
 al mercado  y arregla     devuelve       vuelve atrás   y Apple      gasto

              + GERENTE DE CORREO (sesión propia, ya existía)
```

## Los puestos

| Puesto                 | Qué hace                                                                                       | Puede                                     | Tiene prohibido                                |
| ---------------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------- | ---------------------------------------------- |
| Jefe de operaciones    | Ordena la fila, asigna cada punto, revisa que se cierre                                        | Editar FILA, PENDIENTES y la bitácora     | Programar, publicar, tocar la base             |
| Investigador           | Estudia cómo lo hacen los grandes (REA, documentación pública, código abierto) y deja la ficha | Escribir en la carpeta de investigaciones | Tocar código; descompilar apps ajenas          |
| Desarrollador          | Construye y arregla, con prueba en rojo                                                        | Editar código, commits en rama            | Aprobarse a sí mismo                           |
| Revisor de calidad     | Revisa el cambio y corre la verificación; APROBADO o DEVUELTO                                  | Leer y correr pruebas                     | Editar código                                  |
| Guardia de producción  | Vigila salud y pagos; vuelve a la última versión buena en emergencia                           | Leer, consultar salud, revertir           | Código nuevo, datos, claves                    |
| Tiendas y lanzamientos | Google Play y Apple; sube solo sin revisión en curso                                           | Compilar y subir                          | Subir con revisión en curso, aceptar contratos |
| Tesorero               | Mira gastos y saldos de proveedores y avisa                                                    | Solo lectura                              | Mover dinero de cualquier forma                |
| Gerente de correo      | Contesta los casos de soporte (ya existía, sesión aparte)                                      | Responder tickets                         | Lo que diga su propio contrato                 |

## El contrato de cada puesto

Cada puesto tiene una ficha con cinco cosas: qué hace, qué herramientas usa, qué tiene prohibido,
a quién le pasa el problema y dónde deja escrito lo que hizo. Las fichas viven en la carpeta de
agentes de Claude de esta computadora (`~/.claude/agents/`), así que sirven en todos los proyectos.

## Las reglas de la casa (iguales para todos)

1. Un solo carril: cada puesto hace solo lo suyo.
2. Un proyecto a la vez: el de la carpeta donde se llamó al puesto.
3. Dinero, legal, cuentas nuevas, claves no guardadas y borrar datos suben siempre a Richard.
4. Comunicación por escrito: la tarea se deja en `FILA.md` con la etiqueta `[para: <puesto>]`.
5. Registro: cada puesto deja una línea en `BITACORA-AGENTES.md` del proyecto al terminar.
6. Informe final corto y comprobado; nunca «listo» sin comprobar.

## El recorrido de una función nueva

1. El jefe la asigna al investigador.
2. El investigador deja la ficha y pasa la tarea al desarrollador.
3. El desarrollador la construye con su prueba en rojo y la pasa al revisor.
4. El revisor la aprueba o la devuelve.
5. Aprobada, se publica por el flujo del proyecto; si toca una app, la toma el de tiendas.
6. El guardia comprueba en vivo que todo sigue en ok.
7. El jefe ve las líneas en la bitácora y la da por cerrada.

## Cómo se llama a un puesto

Dentro de cualquier sesión de Claude Code se le pide por su nombre, por ejemplo
«que el revisor de calidad revise este cambio» o «guardia, revisa producción». Claude lo lanza
como un ayudante con sus permisos limitados. Los puestos que deben trabajar solos y a diario
(guardia, tesorero, jefe) se encienden con una tarea programada que los llama a su hora.

## Qué viene después

- Encender las tareas programadas del guardia (cada mañana), del tesorero (cada semana) y del
  jefe (cada día).
- Sumar, cuando haga falta, marketing y contenido, y seguridad. No antes: se agrega un puesto solo
  cuando de verdad hay trabajo para él.
