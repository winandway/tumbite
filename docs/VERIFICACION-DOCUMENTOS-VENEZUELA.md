# Documentos de verificación de Venezuela: qué se pide de cada cara

Venezuela. Decidido por Richard el 26 nov 2026. Candados: C-DOCUMENTO-SIN-REVERSO y C-LICENCIA-REVERSO-OPCIONAL.

## La regla

| Documento                         | Frente        | Reverso                                                  | Por qué                                                                                  |
| --------------------------------- | ------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Cédula de identidad               | Obligatorio   | No se pide                                               | Por detrás no trae datos útiles: es una lámina con un número de serie.                   |
| Licencia de conducir              | Obligatorio   | Opcional: la app lo ofrece y nunca aparece en «te falta» | El cruce y la vigencia se hacen con el frente. El reverso solo trae datos de emergencia. |
| Carta médica (certificado médico) | Una sola foto | —                                                        | En «Tus papeles» siempre fue una sola foto.                                              |

Palabras de Richard: «la licencia tiene dos caras, pero nosotros, si pasan una, será suficiente con la del frente… la primera cara es la que interesa para comparar la cara con la cédula y hacer todo lo que hace el cruce de datos y la parte del vencimiento. La parte trasera, si no la sube, no le damos tanta importancia por ahora, pero no hay que quitar la opción… En el futuro iremos endureciendo las reglas».

## Qué trae cada cara de la licencia

Fuente: lámina oficial del INTT que publicó el diario El Venezolano en abril de 2024, según la pasó Richard por Gerencia. **[DOC, no verificada por nosotros]**: el 26 nov 2026 no pudimos abrir la lámina original.

- **Frente:** la foto, el nombre, la cédula, la fecha de nacimiento, la fecha de expedición, la de vencimiento, el tipo o grado y un código QR. Con el frente se cruzan la cara y el nombre con la cédula y se revisa la vigencia.
- **Reverso:** un teléfono de emergencia, información médica, el grupo sanguíneo, el factor RH, las alergias y el código de seguridad.

Los datos médicos del reverso son sensibles. Por eso la regla no obliga a subirlo. Si alguna vez se vuelve obligatorio, la política de privacidad tiene que decir antes para qué se usan.

## Dónde vive la regla (un solo lugar)

`politicaPlazoDeFabrica('VE')` en `packages/compartido/src/plazoPapeles.ts`:

- `sinReverso: ['doc_reverso', 'licencia_reverso']`: los reversos que no se exigen.
- `reversoOpcional: ['licencia_reverso']`: de esos, los que la app igual ofrece.

**Para endurecer** («reverso obligatorio: sí»), se quita `licencia_reverso` de las dos listas. Es un solo cambio, y también se puede escribir por país desde el superadmin (`plazoPapeles` de la configuración del país). De esa política salen el asistente de fotos, el envío a revisión, «lo que te falta» (Driver, WhatsApp y Camila), la ficha de Verificaciones y «pedir otra foto».

## Cómo se ve

- **Driver (versión nueva):** después del frente de la licencia ofrece «Si tu licencia tiene parte de atrás, súbela también. Es opcional: con el frente basta», con «Saltar este paso». En «Revisa tus papeles» sale como «Opcional» y no frena «Enviar».
- **Driver (versión ya publicada):** no ve el paso opcional. El servidor solo lo manda a la app que lo pide con `?opcionales=1`, así que no se traba a nadie.
- **Equipo:** el reverso aparece en la ficha solo si el conductor lo subió, marcado como opcional. No se puede «pedir otra foto» de él.
