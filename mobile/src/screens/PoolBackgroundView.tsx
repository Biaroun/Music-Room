import React, { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import {
    Canvas,
    Fill,
    Shader,
    Skia,
    useClock,
    Line,
    vec,
    LinearGradient as SkiaLinearGradient,
    DashPathEffect,
} from '@shopify/react-native-skia';
import { useDerivedValue } from 'react-native-reanimated';
import type { Person } from './FriendsScreen';

// polar (angle in deg + distance in percent of vmin) to x y from the center
function toXY(ang: number, dst: number, vmin: number) {
    const rad = (ang * Math.PI) / 180;
    const d = (dst / 100) * vmin;
    return { x: Math.cos(rad) * d, y: Math.sin(rad) * d };
}

// skia shader of the pool (gradient tiles moving bubbles sparkles vignette)
const POOL_SHADER = `
uniform float2 u_resolution;
uniform float u_time;

half4 main(float2 fragCoord) {
    float2 center = u_resolution * 0.5;
    float vm = min(u_resolution.x, u_resolution.y);
    float t = u_time;

    // degrade radial profond (deep pool)
    float dist = distance(fragCoord, float2(center.x, center.y * 0.88))
                 / (max(u_resolution.x, u_resolution.y) * 0.95);
    dist = clamp(dist, 0.0, 1.0);
    float3 c1 = float3(0.063, 0.180, 0.322); // #102e52
    float3 c2 = float3(0.031, 0.118, 0.220); // #081e38
    float3 c3 = float3(0.012, 0.051, 0.114); // #030d1d
    float3 col = dist < 0.5 ? mix(c1, c2, dist / 0.5) : mix(c2, c3, (dist - 0.5) / 0.5);

    // grille de carrelage qui derive lentement
    float ts = vm * 0.09;
    float2 g = abs(fract((fragCoord + float2(t * 0.38, t * 0.22)) / ts) - 0.5);
    float line = smoothstep(0.0, 0.03, min(g.x, g.y));
    col += float3(0.117, 0.333, 0.627) * (1.0 - line) * 0.05;

    for (int i = 0; i < 22; i++) {
        float fi = float(i);
        float ph = (fi / 22.0) * 6.2831853;
        float orb = vm * (0.15 + 0.27 * abs(sin(fi * 0.78)));
        float bx = center.x + cos(ph + t * 0.065) * orb + sin(t * 0.11 + fi * 1.5) * vm * 0.042;
        float by = center.y + sin(ph + t * 0.048) * orb * 0.73 + cos(t * 0.08 + fi * 1.9) * vm * 0.036;
        float bs = vm * (0.037 + 0.022 * sin(t * 0.28 + fi));
        float al = 0.036 + 0.023 * sin(t * 0.5 + fi * 0.65);
        float fall = max(0.0, 1.0 - distance(fragCoord, float2(bx, by)) / bs);
        col += float3(0.41, 0.84, 1.0) * fall * fall * al * 2.8;
    }

    // etincelles brillantes
    for (int i = 0; i < 8; i++) {
        float fi = float(i);
        float ph = (fi / 8.0) * 6.2831853;
        float r = vm * (0.06 + 0.13 * sin(fi * 0.85 + t * 0.09));
        float hx = center.x + cos(ph + t * 0.13) * r;
        float hy = center.y + sin(ph + t * 0.1) * r * 0.78;
        float hs = vm * (0.017 + 0.012 * sin(t * 0.38 + fi));
        float ha = 0.09 + 0.055 * sin(t * 0.55 + fi * 0.75);
        float fall = max(0.0, 1.0 - distance(fragCoord, float2(hx, hy)) / hs);
        col += float3(0.92, 0.99, 1.0) * fall * fall * ha * 3.2;
    }

    // vignette
    float vd = distance(fragCoord, center) / (max(u_resolution.x, u_resolution.y) * 0.75);
    vd = clamp((vd - 0.4) / 0.6, 0.0, 1.0);
    col = mix(col, float3(0.004, 0.020, 0.055), vd * 0.7);

    return half4(col, 1.0);
}
`;

// friends to link + canvas size + center
export type PoolBackgroundProps = {
    friends: Person[];
    width: number;
    height: number;
    vmin: number;
    cx: number;
    cy: number;
};

// animated pool background + a dashed line from the center to each friend
export default function PoolBackground({ friends, width, height, vmin, cx, cy }: PoolBackgroundProps) {
    const clock = useClock();
    const effect = useMemo(() => Skia.RuntimeEffect.Make(POOL_SHADER), []);

    const uniforms = useDerivedValue(() => ({
        u_resolution: [width, height],
        // clock is in ms and the shader want seconds
        u_time: clock.value / 1000,
    }));

    // dash offset that move 15px per second so the lines look alive
    const phase = useDerivedValue(() => -(clock.value / 1000) * 15);

    // shader didnt compile = nothing to draw
    if (!effect) {
        return null;
    }

    return (
        <Canvas style={StyleSheet.absoluteFill}>
            <Fill>
                <Shader source={effect} uniforms={uniforms} />
            </Fill>

            {/* one gradient dashed line per friend */}
            {friends.map(p => {
                const { x, y } = toXY(p.ang, p.dst, vmin);
                return (
                    <Line
                        key={p.key}
                        p1={vec(cx, cy)}
                        p2={vec(cx + x, cy + y)}
                        style="stroke"
                        strokeWidth={1}
                    >
                        <SkiaLinearGradient
                            start={vec(cx, cy)}
                            end={vec(cx + x, cy + y)}
                            colors={['rgba(29,185,84,0.55)', 'rgba(29,185,84,0.12)', 'rgba(29,185,84,0.02)']}
                            positions={[0, 0.6, 1]}
                        />
                        <DashPathEffect intervals={[3, 8]} phase={phase} />
                    </Line>
                );
            })}
        </Canvas>
    );
}
