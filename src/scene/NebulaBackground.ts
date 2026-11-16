import * as THREE from 'three';
import type { CosmicPaletteConfig } from './paletteConfig';

interface CloudWisp {
  sprite: THREE.Sprite;
  basePos: THREE.Vector3;
  speed: number;
  phase: number;
  useSecondary: boolean;
}

export class NebulaBackground {
  public readonly group = new THREE.Group();
  private skyMesh: THREE.Mesh;
  private skyMaterial: THREE.ShaderMaterial;
  private skyGeometry: THREE.SphereGeometry;
  private wisps: CloudWisp[] = [];
  private wispMaterials: THREE.SpriteMaterial[] = [];

  constructor(palette: CosmicPaletteConfig, cloudTexture: THREE.Texture) {
    this.skyGeometry = new THREE.SphereGeometry(95, 32, 24);
    this.skyMaterial = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uDeep: { value: new THREE.Color(palette.deepColor) },
        uMid: { value: new THREE.Color(palette.midColor) },
        uNebulaA: { value: new THREE.Color(palette.nebulaPrimary) },
        uNebulaB: { value: new THREE.Color(palette.nebulaSecondary) },
      },
      vertexShader: `
        varying vec3 vWorldDir;
        void main() {
          vWorldDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uDeep;
        uniform vec3 uMid;
        uniform vec3 uNebulaA;
        uniform vec3 uNebulaB;
        varying vec3 vWorldDir;

        float hash(vec3 p) {
          p = fract(p * 0.3183099 + 0.1);
          p *= 17.0;
          return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
        }

        float noise(vec3 x) {
          vec3 i = floor(x);
          vec3 f = fract(x);
          f = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
                mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
            mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
                mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y),
            f.z
          );
        }

        float fbm(vec3 p) {
          float v = 0.0;
          float a = 0.5;
          for (int i = 0; i < 3; i++) {
            v += a * noise(p);
            p = p * 2.04 + vec3(1.7, 9.2, 3.1);
            a *= 0.5;
          }
          return v;
        }

        void main() {
          vec3 dir = normalize(vWorldDir);
          float horizon = smoothstep(-0.75, 0.80, dir.y);
          vec3 base = mix(uDeep, uMid, horizon * 0.60);

          vec3 driftA = dir * 2.3 + vec3(uTime * 0.015, -uTime * 0.008, uTime * 0.01);
          vec3 driftB = dir * 3.1 + vec3(-uTime * 0.012, uTime * 0.011, -uTime * 0.009);

          float cloudA = smoothstep(0.36, 0.85, fbm(driftA));
          float cloudB = smoothstep(0.42, 0.88, fbm(driftB));

          // Milky-way style diagonal luminosity band
          float band = exp(-pow((dir.y * 0.75 - dir.x * 0.48 + 0.08) * 2.4, 2.0));

          vec3 col = base;
          col = mix(col, uNebulaA, cloudA * (0.24 + band * 0.24));
          col = mix(col, uNebulaB, cloudB * (0.20 + band * 0.22));
          col += (uNebulaA * 0.12 + uNebulaB * 0.10) * band;

          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });

    this.skyMesh = new THREE.Mesh(this.skyGeometry, this.skyMaterial);
    this.skyMesh.renderOrder = -10;
    this.group.add(this.skyMesh);

    // Layered soft depth nebula cloud wisps behind the constellation
    const wispSpecs = [
      { pos: [-11, 4.5, -22], scale: 24, secondary: false, opacity: 0.2 },
      { pos: [12, -3.5, -24], scale: 26, secondary: true, opacity: 0.18 },
      { pos: [0, 7.0, -28], scale: 32, secondary: false, opacity: 0.15 },
      { pos: [-7, -6.5, -20], scale: 22, secondary: true, opacity: 0.17 },
      { pos: [8, 5.5, -19], scale: 20, secondary: false, opacity: 0.14 },
    ];

    wispSpecs.forEach((spec, idx) => {
      const mat = new THREE.SpriteMaterial({
        map: cloudTexture,
        color: spec.secondary ? palette.nebulaSecondary : palette.nebulaPrimary,
        transparent: true,
        opacity: spec.opacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      this.wispMaterials.push(mat);

      const sprite = new THREE.Sprite(mat);
      sprite.position.set(spec.pos[0], spec.pos[1], spec.pos[2]);
      sprite.scale.set(spec.scale, spec.scale * 0.72, 1);
      sprite.renderOrder = -5;
      this.group.add(sprite);

      this.wisps.push({
        sprite,
        basePos: sprite.position.clone(),
        speed: 0.12 + idx * 0.03,
        phase: idx * 1.4,
        useSecondary: spec.secondary,
      });
    });
  }

  public setPalette(palette: CosmicPaletteConfig): void {
    this.skyMaterial.uniforms.uDeep.value.set(palette.deepColor);
    this.skyMaterial.uniforms.uMid.value.set(palette.midColor);
    this.skyMaterial.uniforms.uNebulaA.value.set(palette.nebulaPrimary);
    this.skyMaterial.uniforms.uNebulaB.value.set(palette.nebulaSecondary);

    this.wisps.forEach((w, idx) => {
      this.wispMaterials[idx].color.set(
        w.useSecondary ? palette.nebulaSecondary : palette.nebulaPrimary,
      );
    });
  }

  public update(elapsed: number, reducedMotion: boolean): void {
    const t = reducedMotion ? elapsed * 0.12 : elapsed;
    this.skyMaterial.uniforms.uTime.value = t;

    if (!reducedMotion) {
      for (const w of this.wisps) {
        w.sprite.position.x = w.basePos.x + Math.sin(t * w.speed + w.phase) * 0.85;
        w.sprite.position.y = w.basePos.y + Math.cos(t * w.speed * 0.8 + w.phase) * 0.55;
      }
    }
  }

  public dispose(): void {
    this.skyGeometry.dispose();
    this.skyMaterial.dispose();
    for (const mat of this.wispMaterials) {
      mat.dispose();
    }
  }
}
