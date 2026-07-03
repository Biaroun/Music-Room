import { registerRootComponent } from 'expo';
import App from './App';

// natif : rien à charger pour Skia, on lance direct
export function bootstrap() {
  registerRootComponent(App);
}
