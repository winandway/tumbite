import { useRef } from 'react';
import { Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { Boton } from '@tumbite/movil';

/**
 * Firma del destinatario con el dedo, en un lienzo dentro de la vista web que la app ya trae
 * (sin dependencias nuevas). Devuelve la imagen PNG como «data:…»; la app la sube como prueba.
 */
const HTML = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<style>html,body{margin:0;height:100%;background:#fff;touch-action:none}canvas{width:100%;height:100%;display:block}</style></head>
<body><canvas id="c"></canvas><script>
var c=document.getElementById('c'),x=c.getContext('2d'),d=false,usado=false;
function tam(){var r=window.devicePixelRatio||1;c.width=c.clientWidth*r;c.height=c.clientHeight*r;x.scale(r,r);x.lineWidth=2.5;x.lineCap='round';x.strokeStyle='#101010';}
tam();
function p(e){var t=e.touches?e.touches[0]:e,b=c.getBoundingClientRect();return{x:t.clientX-b.left,y:t.clientY-b.top};}
function ini(e){d=true;usado=true;var q=p(e);x.beginPath();x.moveTo(q.x,q.y);e.preventDefault();}
function mov(e){if(!d)return;var q=p(e);x.lineTo(q.x,q.y);x.stroke();e.preventDefault();}
function fin(){d=false;}
c.addEventListener('touchstart',ini);c.addEventListener('touchmove',mov);c.addEventListener('touchend',fin);
c.addEventListener('mousedown',ini);c.addEventListener('mousemove',mov);c.addEventListener('mouseup',fin);
window.borrar=function(){x.clearRect(0,0,c.width,c.height);usado=false;};
window.guardar=function(){window.ReactNativeWebView.postMessage(usado?c.toDataURL('image/png'):'vacia');};
</script></body></html>`;

export function Firma({
  textos,
  alGuardar,
}: {
  textos: { firmaAqui: string; borrarFirma: string; guardarFirma: string };
  alGuardar: (dataUrl: string) => void;
}) {
  const vista = useRef<WebView>(null);
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ color: '#5E5E5E' }}>{textos.firmaAqui}</Text>
      <View
        style={{
          height: 200,
          borderWidth: 1,
          borderColor: '#2a2a2a',
          borderRadius: 10,
          overflow: 'hidden',
        }}
      >
        <WebView
          ref={vista}
          originWhitelist={['*']}
          source={{ html: HTML }}
          scrollEnabled={false}
          onMessage={(e) => {
            if (e.nativeEvent.data !== 'vacia') alGuardar(e.nativeEvent.data);
          }}
        />
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Boton
            texto={textos.borrarFirma}
            secundario
            alTocar={() => vista.current?.injectJavaScript('borrar();true;')}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Boton
            texto={textos.guardarFirma}
            alTocar={() => vista.current?.injectJavaScript('guardar();true;')}
          />
        </View>
      </View>
    </View>
  );
}
