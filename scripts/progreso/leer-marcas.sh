#!/usr/bin/env bash
# Lo que Richard marcó como «Ya lo hice» en la página de progreso (se lee antes de cada respuesta).
curl -s https://divoox-progreso.sitios.dev/datos/marcas | python3 -c '
import json, sys
m = json.load(sys.stdin)["marcas"]
for x in m:
    estado = "HECHO" if x["hecho"] else "pendiente"
    print(x["id"], estado, x["quien"], x["actualizado_en"], x["nota"], sep=" · ")
if not m:
    print("Sin marcas.")
'
