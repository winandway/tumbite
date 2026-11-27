import type { AppDeCelular } from '@tumbite/compartido';

/**
 * C-CUENTA-UNICA (27 nov 2026, mototaxista real de Tucaní): quien ya tiene su cuenta de Divoox y se
 * registra en la otra app entra con ELLA. Si no recuerda la contraseña, «¿Olvidaste tu contraseña?» le
 * manda un código al celular confirmado (C-RECUPERAR-POR-CELULAR). Lo dice el servidor: sirve también
 * en las apps ya publicadas.
 */
export function mensajeYaTienesCuenta(
  con: 'correo' | 'telefono',
  papel: AppDeCelular | null,
): string {
  const dato = con === 'correo' ? 'este correo' : 'este celular';
  const para =
    papel === 'repartidor'
      ? 'para registrarte como conductor'
      : papel === 'cliente'
        ? 'para pedir con ella'
        : 'para usarla también aquí';
  const como =
    con === 'correo'
      ? 'Toca «Entrar» y usa tu misma contraseña.'
      : 'Toca «Entrar» y usa el correo y la contraseña de esa cuenta.';
  return `Ya tienes una cuenta de Divoox con ${dato}. Entra con ella ${para}: no hace falta otra. ${como} ¿No la recuerdas? Toca «¿Olvidaste tu contraseña?» y te mandamos un código por WhatsApp o SMS.`;
}
