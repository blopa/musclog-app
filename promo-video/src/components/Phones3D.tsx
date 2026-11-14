import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { ThreeCanvas } from '@remotion/three';
import { useThree } from '@react-three/fiber';
import {
  continueRender,
  delayRender,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

/**
 * Loads a screen texture and holds the render until the canvas has been redrawn with it. While
 * rendering, <ThreeCanvas> draws only when the frame number changes, so a texture that arrives
 * after that draw would otherwise be missing from the captured frame.
 */
const useImageTexture = (url: string) => {
  const { advance } = useThree();
  const [tex, setTex] = useState<THREE.Texture | null>(null);
  const [handle] = useState(() => delayRender(`texture ${url}`));
  useEffect(() => {
    new THREE.TextureLoader().load(url, (t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 8;
      setTex(t);
    });
  }, [url]);
  useLayoutEffect(() => {
    if (tex) {
      advance(performance.now());
      continueRender(handle);
    }
  }, [tex, advance, handle]);
  return tex;
};

/** A rounded rectangle whose UVs span its bounds, so a texture fills it corner to corner. */
const roundedRect = (w: number, h: number, r: number) => {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  const g = new THREE.ShapeGeometry(s, 12);
  const pos = g.attributes.position;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = (pos.getX(i) - x) / w;
    uv[i * 2 + 1] = (pos.getY(i) - y) / h;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
};

// Screen textures are 1080x2480 (the capture plus a status-bar band).
const SCREEN_ASPECT = 1080 / 2480;

export type PhoneSpec = {
  screen: string;
  x: number;
  y: number;
  z: number;
  height: number;
  rotY: number;
  rotX?: number;
  rotZ?: number;
  phase?: number;
  delay?: number;
  /** Where the phone enters from. */
  from?: 'bottom' | 'left' | 'right' | 'front';
  /** Extra turn over the scene, in radians, so a held shot keeps moving. */
  drift?: number;
  sway?: number;
};

const Phone: React.FC<PhoneSpec> = ({
  screen,
  x,
  y,
  z,
  height,
  rotY,
  rotX = 0,
  rotZ = 0,
  phase = 0,
  delay = 0,
  from = 'bottom',
  drift = 0,
  sway = 1,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const t = frame / fps;
  const tex = useImageTexture(staticFile(screen));

  const sh = height * 0.955;
  const sw = sh * SCREEN_ASPECT;
  const W = sw + height * 0.045;
  const H = height;
  const D = 0.17;

  const body = useMemo(() => new RoundedBoxGeometry(W, H, D, 6, 0.08), [W, H]);
  const screenGeo = useMemo(() => roundedRect(sw, sh, sw * 0.085), [sw, sh]);
  const bezelGeo = useMemo(() => roundedRect(W - 0.03, H - 0.03, W * 0.11), [W, H]);

  const enter = spring({
    frame: frame - delay,
    fps,
    config: { damping: 15, stiffness: 80, mass: 1.1 },
  });
  const off = 1 - enter;
  const ex = from === 'left' ? -6 * off : from === 'right' ? 6 * off : 0;
  const ey = from === 'bottom' ? -4.2 * off : 0;
  const ez = from === 'front' ? 5 * off : 0;
  const spin = (from === 'left' ? -0.9 : from === 'right' ? 0.9 : 0.5) * off;

  const progress = frame / durationInFrames;
  const bob = Math.sin(t * 1.2 + phase) * 0.045 * sway;
  const ry = rotY + spin + drift * progress + Math.sin(t * 0.5 + phase) * 0.06 * sway;
  const rx = rotX + Math.sin(t * 0.4 + phase * 1.7) * 0.03 * sway;

  return (
    <group position={[x + ex, y + ey + bob, z + ez]} rotation={[rx, ry, rotZ]}>
      <mesh geometry={body}>
        <meshStandardMaterial color="#1f2624" metalness={0.85} roughness={0.32} />
      </mesh>
      <mesh geometry={bezelGeo} position={[0, 0, D / 2 + 0.001]}>
        <meshBasicMaterial color="#050807" />
      </mesh>
      <mesh geometry={screenGeo} position={[0, 0, D / 2 + 0.003]}>
        {tex ? (
          <meshBasicMaterial map={tex} toneMapped={false} />
        ) : (
          <meshBasicMaterial color="#0d1210" />
        )}
      </mesh>
      <mesh position={[0, sh / 2 - sh * 0.026, D / 2 + 0.006]}>
        <circleGeometry args={[sw * 0.028, 32]} />
        <meshBasicMaterial color="#020303" />
      </mesh>
      {/* Side keys */}
      <mesh position={[W / 2 + 0.008, H * 0.2, 0]}>
        <boxGeometry args={[0.03, H * 0.13, 0.07]} />
        <meshStandardMaterial color="#2a3330" metalness={0.9} roughness={0.3} />
      </mesh>
      <mesh position={[W / 2 + 0.008, H * 0.03, 0]}>
        <boxGeometry args={[0.03, H * 0.07, 0.07]} />
        <meshStandardMaterial color="#2a3330" metalness={0.9} roughness={0.3} />
      </mesh>
    </group>
  );
};

/** 1 scene unit is about 204 px at the default camera (z 9.2, fov 32) on a 1080 px tall frame. */
export const PX = 1080 / (2 * 9.2 * Math.tan((16 * Math.PI) / 180));
export const toUnitsX = (px: number) => (px - 960) / PX;
export const toUnitsY = (px: number) => (540 - px) / PX;

export const Phones3D: React.FC<{ phones: PhoneSpec[]; cameraZ?: number }> = ({
  phones,
  cameraZ = 9.2,
}) => {
  const { width, height } = useVideoConfig();
  return (
    <ThreeCanvas width={width} height={height} camera={{ fov: 32, position: [0, 0, cameraZ] }}>
      <ambientLight intensity={0.7} />
      <directionalLight position={[4, 6, 7]} intensity={2.0} />
      <pointLight position={[-7, -2, 3]} intensity={70} color="#34d399" />
      <pointLight position={[7, -5, -1]} intensity={45} color="#10b981" />
      <pointLight position={[0, 6, -4]} intensity={30} color="#a7f3d0" />
      {phones.map((p, i) => (
        <Phone key={`${p.screen}-${i}`} {...p} />
      ))}
    </ThreeCanvas>
  );
};
