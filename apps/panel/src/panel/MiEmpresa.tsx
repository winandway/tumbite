import { useEffect, useState } from 'react';
import {
  ErrorApi,
  type Idioma,
  type Usuario,
  almacenNavegador,
  enIdioma,
  useBorrador,
} from '@tumbite/compartido';
import { AvisoBorrador } from './AvisoBorrador';
import { Campo } from './CampoClave';
import { pedir } from './api';
import { VerificacionPanel } from './VerificacionPanel';

const T = {
  es: {
    titulo: 'Mi empresa',
    ayuda:
      'Los datos legales de tu negocio y las personas a cargo. Los ve solo el equipo de Tumbite. El número fiscal y el banco los pide Stripe al conectar tu billetera.',
    negocio: 'Tu negocio',
    nombreLegal: 'Nombre legal de la empresa',
    tipoEmpresa: 'Tipo de empresa (LLC, corporación, persona…)',
    direccionFiscal: 'Dirección fiscal',
    horario: 'Horario de atención',
    sitioWeb: 'Sitio web o red social',
    dueno: 'Dueño',
    manager: 'Manager o encargado',
    nombre: 'Nombre y apellido',
    telefono: 'Celular',
    correo: 'Correo',
    guardar: 'Guardar',
    guardado: 'Guardado',
  },
  en: {
    titulo: 'My company',
    ayuda:
      'Your business’s legal details and the people in charge. Only the Tumbite team sees them. Stripe asks for your tax ID and bank when you connect your wallet.',
    negocio: 'Your business',
    nombreLegal: 'Legal company name',
    tipoEmpresa: 'Company type (LLC, corporation, sole proprietor…)',
    direccionFiscal: 'Tax address',
    horario: 'Business hours',
    sitioWeb: 'Website or social media',
    dueno: 'Owner',
    manager: 'Manager',
    nombre: 'Full name',
    telefono: 'Mobile phone',
    correo: 'Email',
    guardar: 'Save',
    guardado: 'Saved',
  },
};

const INICIAL = {
  nombreLegal: '',
  tipoEmpresa: '',
  direccionFiscal: '',
  horario: '',
  sitioWeb: '',
  duenoNombre: '',
  duenoTelefono: '',
  duenoCorreo: '',
  managerNombre: '',
  managerTelefono: '',
  managerCorreo: '',
};

/** Datos de la empresa del restaurante (como pide DoorDash). Nunca pierde lo escrito. */
export function MiEmpresa({ usuario, idioma }: { usuario: Usuario; idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const b = useBorrador({
    formulario: 'empresa',
    cuenta: usuario.id,
    inicial: INICIAL,
    almacen: almacenNavegador,
  });
  const { cargarBase } = b;
  const [error, setError] = useState<{ mensaje: string; campo?: string } | null>(null);
  const [aviso, setAviso] = useState('');
  useEffect(() => {
    pedir<{ empresa: typeof INICIAL }>('GET', '/datos/mi-restaurante/empresa')
      .then((r) => cargarBase({ ...INICIAL, ...r.empresa }))
      .catch((x: unknown) => setError({ mensaje: x instanceof ErrorApi ? x.message : String(x) }));
  }, [cargarBase]);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setAviso('');
    try {
      await pedir('PUT', '/datos/mi-restaurante/empresa', b.valores);
      await b.cargar(b.valores);
      setAviso(t.guardado);
    } catch (x) {
      setError(
        x instanceof ErrorApi ? { mensaje: x.message, campo: x.campo } : { mensaje: String(x) },
      );
    }
  }

  const campo = (clave: keyof typeof INICIAL, etiqueta: string, tipo = 'text') => (
    <Campo
      etiqueta={etiqueta}
      tipo={tipo}
      valor={new Map(Object.entries(b.valores)).get(clave) ?? ''}
      cambiar={(x) => b.cambiar(clave, x)}
      error={error?.campo === clave ? error.mensaje : undefined}
      placeholder={tipo === 'email' ? 'correo@ejemplo.com' : etiqueta}
    />
  );

  return (
    <section>
      <h1>{t.titulo}</h1>
      <p>{t.ayuda}</p>
      <form onSubmit={guardar} className="formulario tarjeta-form" noValidate>
        <AvisoBorrador
          visible={b.recuperado}
          idioma={idioma}
          empezar={() => void b.empezarDeNuevo()}
        />
        <h2>{t.negocio}</h2>
        {campo('nombreLegal', t.nombreLegal)}
        {campo('tipoEmpresa', t.tipoEmpresa)}
        {campo('direccionFiscal', t.direccionFiscal)}
        {campo('horario', t.horario)}
        {campo('sitioWeb', t.sitioWeb)}
        <h2>{t.dueno}</h2>
        {campo('duenoNombre', t.nombre)}
        {campo('duenoTelefono', t.telefono, 'tel')}
        {campo('duenoCorreo', t.correo, 'email')}
        <h2>{t.manager}</h2>
        {campo('managerNombre', t.nombre)}
        {campo('managerTelefono', t.telefono, 'tel')}
        {campo('managerCorreo', t.correo, 'email')}
        {aviso && (
          <p className="ok" role="status">
            {aviso}
          </p>
        )}
        {error && !error.campo && (
          <p className="error-general" role="alert">
            {error.mensaje}
          </p>
        )}
        <button type="submit" className="boton">
          {t.guardar}
        </button>
      </form>
      <VerificacionPanel idioma={idioma} />
    </section>
  );
}
