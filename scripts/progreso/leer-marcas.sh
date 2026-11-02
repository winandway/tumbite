#!/usr/bin/env bash
# Lo que Richard marcó como «Ya lo hice» en la página de progreso (se lee antes de cada respuesta).
curl -s https://divoox-progreso.sitios.dev/datos/marcas | python3 -c '
import json,sys
m=json.load(sys.stdin)["marcas"]
print("\n".join(f"{x[\"id\"]}: {\"HECHO\" if x[\"hecho\"] else \"pendiente\"} · {x[\"quien\"]} · {x[\"actualizado_en\"]} · {x[\"nota\"]}" for x in m) or "Sin marcas.")'
