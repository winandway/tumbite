#!/usr/bin/env bash
# Lo que Richard marcó como «Ya lo hice» en la página de progreso (se lee antes de cada respuesta).
# Cada punto tiene su número fijo («Progreso 3»): sale primero, para hablar de él por su número.
cd "$(dirname "$0")/../.."
curl -s https://divoox-progreso.sitios.dev/datos/marcas | python3 -c '
import json, sys
m = json.load(sys.stdin)["marcas"]
try:
    numeros = {e["id"]: e.get("numero") for e in json.load(open("progreso/datos.json"))["esperando"]}
except Exception:
    numeros = {}
for x in m:
    estado = "HECHO" if x["hecho"] else "pendiente"
    n = numeros.get(x["id"])
    print(f"Progreso {n}" if n else "(sin número)", x["id"], estado, x["quien"], x["actualizado_en"], x["nota"], sep=" · ")
if not m:
    print("Sin marcas.")
'
