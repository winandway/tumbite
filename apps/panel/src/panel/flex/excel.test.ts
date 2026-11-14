import { describe, expect, it } from 'vitest';
import { strToU8, zipSync } from 'fflate';
import { leerCsv, mapearEncabezados } from '@tumbite/compartido';
import { COLUMNAS_PLANTILLA, ExcelIlegible, plantillaXlsx, xlsxACsv } from './excel';

/** C-FLEX-EXCEL: el Excel se lee en el navegador y sale el mismo CSV que valida el servidor. */
const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
function libro(hoja: string, compartidos: string[]) {
  return zipSync({
    'xl/workbook.xml': strToU8(
      `<workbook xmlns="${NS}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="A" sheetId="1" r:id="rId9"/></sheets></workbook>`,
    ),
    'xl/_rels/workbook.xml.rels': strToU8(
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId9" Target="worksheets/sheet3.xml"/></Relationships>`,
    ),
    'xl/sharedStrings.xml': strToU8(
      `<sst xmlns="${NS}">${compartidos.map((s) => `<si><t>${s}</t></si>`).join('')}<si><r><t>Av. 15, </t></r><r><t>El Vigía</t></r></si></sst>`,
    ),
    'xl/worksheets/sheet3.xml': strToU8(
      `<worksheet xmlns="${NS}"><sheetData>${hoja}</sheetData></worksheet>`,
    ),
  });
}

describe('C-FLEX-EXCEL · importar desde Excel sin subir el archivo', () => {
  it('lee la primera hoja (texto compartido, en línea, números, celdas vacías) y arma el CSV', () => {
    const x = libro(
      `<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c><c r="D1" t="s"><v>3</v></c></row>
       <row r="2"><c r="A2" t="inlineStr"><is><t>ORD-1</t></is></c><c r="B2" t="s"><v>4</v></c><c r="D2"><v>2</v></c></row>
       <row r="3"><c r="B3" t="inlineStr"><is><t>Paquetes, "La Esquina"</t></is></c><c r="C3" t="s"><v>5</v></c></row>
       <row r="4"></row>`,
      ['reference', 'recipient', 'address', 'packages', 'Cliente Uno', 'x'],
    );
    const csv = xlsxACsv(x);
    expect(csv.split('\r\n')[0]).toBe('reference,recipient,address,packages');
    const filas = leerCsv(csv);
    expect(filas).toHaveLength(3);
    expect(filas[1]).toEqual(['ORD-1', 'Cliente Uno', '', '2']);
    expect(filas[2]?.[1]).toBe('Paquetes, "La Esquina"');
    expect(mapearEncabezados(filas[0]!)).toMatchObject({ destinatario: 1, direccion: 2 });
  });

  it('la plantilla descargable trae solo los títulos y se vuelve a leer igual', () => {
    const csv = xlsxACsv(plantillaXlsx());
    expect(csv).toBe(`${COLUMNAS_PLANTILLA.join(',')}\r\n`);
    const mapa = mapearEncabezados([...COLUMNAS_PLANTILLA]);
    expect(Object.keys(mapa)).toEqual(
      expect.arrayContaining(['referencia', 'destinatario', 'direccion', 'paquetes']),
    );
  });

  it('un archivo que no es Excel, o vacío, se dice en palabras', () => {
    expect(() => xlsxACsv(new TextEncoder().encode('reference,recipient'))).toThrow(ExcelIlegible);
    expect(() => xlsxACsv(libro('', []))).toThrow('vacía');
  });

  it('más de 5.000 filas: se corta antes de convertir, con su motivo', () => {
    const filas = Array.from(
      { length: 5_001 },
      (_, i) => `<row r="${i + 1}"><c r="A${i + 1}" t="inlineStr"><is><t>x</t></is></c></row>`,
    ).join('');
    try {
      xlsxACsv(libro(filas, []));
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ExcelIlegible);
      expect((e as ExcelIlegible).motivo).toBe('filas');
    }
  });
});
