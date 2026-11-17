import { Component, type ReactNode } from 'react';
import { Modal as ModalNativo, type ModalProps } from 'react-native';
import { PantallaConFallo, appDivooxActual } from './PantallaConFallo';

/**
 * C-NUNCA-EN-BLANCO (16 nov 2026, iPhone de Richard: guardar una dirección dejó la app en blanco y
 * sin salida) — todos los países. TODA ventana (Modal) de las tres apps pasa por aquí: lleva dentro
 * su propio atrapador de errores. Si algo falla dentro de la ventana, en vez de una hoja en blanco
 * se ve «Algo falló en esta pantalla» con «Volver», que cierra la ventana; y el fallo llega al
 * registro de errores del servidor. El candado `candadoNuncaEnBlanco.test.ts` exige que ninguna
 * pantalla importe `Modal` de react-native directamente.
 *
 * Regla de la casa: una ventana NO se abre encima de otra ventana. En el iPhone, cerrar dos a la vez
 * deja la de abajo vacía y sin salida (esa fue la pantalla blanca): los pasos van dentro de la misma.
 */
type Estado = { error: Error | null };

export class AtrapaFallos extends Component<
  { pantalla: string; volver: () => void; children?: ReactNode },
  Estado
> {
  override state: Estado = { error: null };

  static getDerivedStateFromError(error: Error): Estado {
    return { error };
  }

  override render() {
    const { error } = this.state;
    if (!error) return this.props.children ?? null;
    return (
      <PantallaConFallo
        app={appDivooxActual()}
        error={error}
        pantalla={this.props.pantalla}
        volver={() => {
          this.setState({ error: null });
          this.props.volver();
        }}
      />
    );
  }
}

export function Modal({ children, onRequestClose, testID, ...props }: ModalProps) {
  return (
    <ModalNativo {...props} testID={testID} onRequestClose={onRequestClose}>
      <AtrapaFallos
        pantalla={`hoja ${testID ?? ''}`.trim()}
        volver={() => onRequestClose?.(undefined as never)}
      >
        {children}
      </AtrapaFallos>
    </ModalNativo>
  );
}
