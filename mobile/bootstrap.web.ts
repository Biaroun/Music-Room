import { registerRootComponent } from 'expo';
import { LoadSkiaWeb } from '@shopify/react-native-skia/lib/commonjs/web';
import App from './App';

// web : faut charger le wasm de Skia avant de lancer l'app (le fichier est dans /public)
export function bootstrap() {
  LoadSkiaWeb({ locateFile: () => '/canvaskit.wasm' }).then(() => {
    registerRootComponent(App);
  });
}
