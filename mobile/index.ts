import { registerRootComponent } from 'expo';
import { Platform } from 'react-native';

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
if (Platform.OS === 'web') {
  // Skia (CanvasKit WASM) must be loaded before the app renders on web.
  // The wasm file was copied to /public/canvaskit.wasm by `npx setup-skia-web public`.
  const { LoadSkiaWeb } = require('@shopify/react-native-skia/lib/commonjs/web');
  LoadSkiaWeb({ locateFile: () => '/canvaskit.wasm' }).then(() => {
    registerRootComponent(App);
  });
} else {
  registerRootComponent(App);
}
