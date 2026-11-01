import { describe, expect, it } from 'vitest';
import { mundo } from '../pruebas/ayuda';
import { B, empresa, llamar } from '../pruebas/flex';

/**
 * C-FLEX-RASTREAR (31 oct 2026, LG3): el cliente escribe un número de seguimiento en su app. Si el
 * envío es para él, queda vinculado a su cuenta; si no, lo sigue solo con el estado público.
 */
async function crearEnvio(m: ReturnType<typeof mundo>, telefono: string) {
  const e = await empresa(m);
  const r = await llamar(
    m,
    'POST',
    `${B}/empresas/${e.id}/envios`,
    {
      centroId: e.centroId,
      destinatarioNombre: 'Quien Recibe',
      destinatarioTelefono: telefono,
      direccion: '10 Main St, Miami',
      lat: 25.8,
      lng: -80.2,
      paquetes: [{ descripcion: 'Caja' }],
    },
    e.dueno.token,
  );
  return {
    envioId: r.datos.envio.id as string,
    codigo: r.datos.envio.paquetes[0].codigoSeguimiento as string,
  };
}

describe('rastrear un paquete desde la app del cliente', () => {
  it('si el teléfono coincide, el envío queda vinculado y aparece en «Mis paquetes»', async () => {
    const m = mundo();
    const cli = await m.cuenta('cliente', 'Rosa Recibe');
    await m.DB.prepare("UPDATE usuarios SET telefono = '+13055550199' WHERE id = ?")
      .bind(cli.id)
      .run();
    const { codigo } = await crearEnvio(m, '(305) 555-0199');
    const r = await llamar(
      m,
      'POST',
      `${B}/mis-paquetes/seguir`,
      { codigo: codigo.toLowerCase() },
      cli.token,
    );
    expect(r.estado).toBe(200);
    expect(r.datos.suyo).toBe(true);
    const mis = await llamar(m, 'GET', `${B}/mis-paquetes`, undefined, cli.token);
    expect(mis.datos.paquetes.map((p: any) => p.codigo)).toContain(codigo);
  });
  it('si no es suyo, lo sigue solo con el estado y sin datos personales', async () => {
    const m = mundo();
    const otro = await m.cuenta('cliente', 'Curioso');
    const { codigo } = await crearEnvio(m, '(305) 555-0111');
    const r = await llamar(m, 'POST', `${B}/mis-paquetes/seguir`, { codigo }, otro.token);
    expect(r.datos.suyo).toBe(false);
    const mis = await llamar(m, 'GET', `${B}/mis-paquetes`, undefined, otro.token);
    expect(mis.datos.paquetes).toHaveLength(0);
    const seg = await llamar(m, 'GET', `${B}/mis-paquetes/seguidos`, undefined, otro.token);
    expect(seg.datos.seguidos[0].codigo).toBe(codigo);
    expect(JSON.stringify(seg.datos)).not.toContain('Main St');
  });
  it('un número que no existe se dice claro', async () => {
    const m = mundo();
    const c = await m.cuenta('cliente', 'Nadie');
    const r = await llamar(
      m,
      'POST',
      `${B}/mis-paquetes/seguir`,
      { codigo: 'DVXAAAAAAAAAA' },
      c.token,
    );
    expect(r.estado).toBe(404);
  });
});
