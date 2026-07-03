import React from 'react';
import { WithSkiaWeb } from '@shopify/react-native-skia/lib/module/web/WithSkiaWeb';
import type { PoolBackgroundProps } from './PoolBackgroundView';

// sur web faut attendre le chargement du wasm de Skia avant de monter le composant,
// donc import dynamique via WithSkiaWeb.
// j'importe PoolBackgroundView et pas PoolBackground sinon Metro reboucle sur ce fichier
export default function PoolBackgroundWeb(props: PoolBackgroundProps) {
    return (
        <WithSkiaWeb
            getComponent={() => import('./PoolBackgroundView')}
            componentProps={props}
        />
    );
}
