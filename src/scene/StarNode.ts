import * as THREE from 'three';
import type { StarShapeId } from '../types/project';
import type { GlowColorConfig } from './paletteConfig';

export interface ShapeGeometryPack {
  body: THREE.BufferGeometry;
  edges: THREE.EdgesGeometry;
}

export interface SharedStarGeometries {
  shapes: Record<StarShapeId, ShapeGeometryPack>;
  innerGem: THREE.OctahedronGeometry;
  flowerCore: THREE.OctahedronGeometry;
  moonStarlet: THREE.OctahedronGeometry;
  cometTailCone: THREE.ConeGeometry;
  cometPlume: THREE.ExtrudeGeometry;
  cometPlumeEdges: THREE.EdgesGeometry;
  planetRing: THREE.TorusGeometry;
  planetMoonlet: THREE.OctahedronGeometry;
  sparkMote: THREE.OctahedronGeometry;
  hitProxy: THREE.SphereGeometry;
  pulseRing: THREE.RingGeometry;
  sparklePoints: THREE.BufferGeometry;
}

function buildStarShapeGeometry(): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  const points = 10; // 5-pointed star
  const outerR = 0.46;
  const innerR = 0.2;
  for (let i = 0; i < points; i++) {
    const angle = (i / points) * Math.PI * 2 + Math.PI / 2;
    const r = i % 2 === 0 ? outerR : innerR;
    const x = Math.cos(angle) * r;
    const y = Math.sin(angle) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.1,
    bevelEnabled: true,
    bevelThickness: 0.065,
    bevelSize: 0.04,
    bevelSegments: 2,
  });
  geo.center();
  return geo;
}

function buildHeartShapeGeometry(): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  const steps = 48;
  const scale = 0.0255;
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const x = 16 * Math.pow(Math.sin(t), 3) * scale;
    const y =
      (13 * Math.cos(t) -
        5 * Math.cos(2 * t) -
        2 * Math.cos(3 * t) -
        Math.cos(4 * t)) *
      scale;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.11,
    bevelEnabled: true,
    bevelThickness: 0.085,
    bevelSize: 0.055,
    bevelSegments: 3,
  });
  geo.center();
  return geo;
}

function buildFlowerShapeGeometry(): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  const steps = 72; // 6 sculpted petals
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const r = 0.185 + 0.275 * Math.pow(Math.abs(Math.sin(3 * t)), 0.72);
    const x = Math.cos(t) * r;
    const y = Math.sin(t) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.08,
    bevelEnabled: true,
    bevelThickness: 0.055,
    bevelSize: 0.035,
    bevelSegments: 2,
  });
  geo.center();
  return geo;
}

function buildMoonShapeGeometry(): THREE.ExtrudeGeometry {
  // Exact intersection of outer circle C1(0,0, R=0.45) & inner bite C2(0.21, 0, R=0.35)
  const r1 = 0.45;
  const cx2 = 0.21;
  const r2 = 0.35;
  const ix = (r1 * r1 - r2 * r2 + cx2 * cx2) / (2 * cx2);
  const iy = Math.sqrt(Math.max(0.001, r1 * r1 - ix * ix));

  const aTop1 = Math.atan2(iy, ix);
  const aBot1 = Math.PI * 2 - aTop1;
  const aBot2 = Math.atan2(-iy, ix - cx2) + Math.PI * 2;
  const aTop2 = Math.atan2(iy, ix - cx2);

  const shape = new THREE.Shape();
  const outerSteps = 26;
  for (let i = 0; i <= outerSteps; i++) {
    const a = THREE.MathUtils.lerp(aTop1, aBot1, i / outerSteps);
    const x = Math.cos(a) * r1;
    const y = Math.sin(a) * r1;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }

  const innerSteps = 20;
  for (let i = 1; i <= innerSteps; i++) {
    const a = THREE.MathUtils.lerp(aBot2, aTop2, i / innerSteps);
    const x = cx2 + Math.cos(a) * r2;
    const y = Math.sin(a) * r2;
    shape.lineTo(x, y);
  }
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.09,
    bevelEnabled: true,
    bevelThickness: 0.06,
    bevelSize: 0.035,
    bevelSegments: 2,
  });
  geo.center();
  geo.rotateZ(0.24);
  return geo;
}

function buildCometPlumeGeometry(): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(0.2, 0.22);
  shape.quadraticCurveTo(0.05, 0.26, -0.34, -0.08);
  shape.quadraticCurveTo(-0.18, -0.06, -0.44, -0.38);
  shape.quadraticCurveTo(-0.08, -0.22, -0.04, -0.36);
  shape.quadraticCurveTo(0.26, -0.02, 0.2, 0.22);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.04,
    bevelEnabled: true,
    bevelThickness: 0.025,
    bevelSize: 0.018,
    bevelSegments: 2,
  });
  return geo;
}

function buildSparkShapeGeometry(): THREE.BufferGeometry {
  // Faceted volumetric 4-pointed diamond crystal (16 crisp triangular facets)
  const rx = 0.48;
  const ry = 0.56;
  const w = 0.105;
  const zPeak = 0.165;

  const ring: Array<[number, number, number]> = [
    [0, ry, 0],
    [-w, w, 0],
    [-rx, 0, 0],
    [-w, -w, 0],
    [0, -ry, 0],
    [w, -w, 0],
    [rx, 0, 0],
    [w, w, 0],
  ];

  const front: [number, number, number] = [0, 0, zPeak];
  const back: [number, number, number] = [0, 0, -zPeak];
  const verts: number[] = [];

  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    // Front crystal facet (CCW toward +Z)
    verts.push(
      front[0], front[1], front[2],
      a[0], a[1], a[2],
      b[0], b[1], b[2],
    );
    // Back crystal facet (CCW toward -Z)
    verts.push(
      back[0], back[1], back[2],
      b[0], b[1], b[2],
      a[0], a[1], a[2],
    );
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

export function createSharedStarGeometries(): SharedStarGeometries {
  const starGeo = buildStarShapeGeometry();
  const heartGeo = buildHeartShapeGeometry();
  const flowerGeo = buildFlowerShapeGeometry();
  const moonGeo = buildMoonShapeGeometry();
  const sparkGeo = buildSparkShapeGeometry();
  const cometHeadGeo = new THREE.IcosahedronGeometry(0.23, 0);
  const planetBodyGeo = new THREE.IcosahedronGeometry(0.28, 1);

  const cometPlume = buildCometPlumeGeometry();

  // Gentle miniature sparkle orbit cloud (8 dust points per object)
  const sparkleCount = 8;
  const sparklePositions = new Float32Array(sparkleCount * 3);
  for (let i = 0; i < sparkleCount; i++) {
    const a = (i / sparkleCount) * Math.PI * 2;
    const r = 0.56 + (i % 2) * 0.14;
    sparklePositions[i * 3] = Math.cos(a) * r;
    sparklePositions[i * 3 + 1] = Math.sin(a) * r * 0.85;
    sparklePositions[i * 3 + 2] = ((i % 3) - 1) * 0.22;
  }
  const sparklePoints = new THREE.BufferGeometry();
  sparklePoints.setAttribute(
    'position',
    new THREE.BufferAttribute(sparklePositions, 3),
  );

  return {
    shapes: {
      star: { body: starGeo, edges: new THREE.EdgesGeometry(starGeo, 20) },
      heart: { body: heartGeo, edges: new THREE.EdgesGeometry(heartGeo, 20) },
      flower: { body: flowerGeo, edges: new THREE.EdgesGeometry(flowerGeo, 20) },
      moon: { body: moonGeo, edges: new THREE.EdgesGeometry(moonGeo, 20) },
      comet: { body: cometHeadGeo, edges: new THREE.EdgesGeometry(cometHeadGeo, 14) },
      planet: { body: planetBodyGeo, edges: new THREE.EdgesGeometry(planetBodyGeo, 18) },
      spark: { body: sparkGeo, edges: new THREE.EdgesGeometry(sparkGeo, 8) },
    },
    innerGem: new THREE.OctahedronGeometry(0.145, 0),
    flowerCore: new THREE.OctahedronGeometry(0.165, 1),
    moonStarlet: new THREE.OctahedronGeometry(0.09, 0),
    cometTailCone: new THREE.ConeGeometry(0.14, 0.72, 7),
    cometPlume,
    cometPlumeEdges: new THREE.EdgesGeometry(cometPlume, 20),
    planetRing: new THREE.TorusGeometry(0.47, 0.042, 8, 40),
    planetMoonlet: new THREE.OctahedronGeometry(0.068, 0),
    sparkMote: new THREE.OctahedronGeometry(0.052, 0),
    hitProxy: new THREE.SphereGeometry(0.78, 12, 10),
    pulseRing: new THREE.RingGeometry(0.48, 0.59, 36),
    sparklePoints,
  };
}

export function disposeSharedStarGeometries(geos: SharedStarGeometries): void {
  Object.values(geos.shapes).forEach((pack) => {
    pack.body.dispose();
    pack.edges.dispose();
  });
  geos.innerGem.dispose();
  geos.flowerCore.dispose();
  geos.moonStarlet.dispose();
  geos.cometTailCone.dispose();
  geos.cometPlume.dispose();
  geos.cometPlumeEdges.dispose();
  geos.planetRing.dispose();
  geos.planetMoonlet.dispose();
  geos.sparkMote.dispose();
  geos.hitProxy.dispose();
  geos.pulseRing.dispose();
  geos.sparklePoints.dispose();
}

export class StarNode {
  public readonly id: string;
  public readonly group = new THREE.Group();
  public readonly hitMesh: THREE.Mesh;
  public readonly homePosition = new THREE.Vector3();
  public readonly desiredPosition = new THREE.Vector3();

  private geos: SharedStarGeometries;
  private currentShape: StarShapeId;

  private crystalGroup = new THREE.Group();
  private bodyPivot = new THREE.Group();
  private sparkleCloud: THREE.Points;
  private haloSprite: THREE.Sprite;
  private flareSprite: THREE.Sprite;
  private pulseRingMesh: THREE.Mesh;
  private linkRingMesh: THREE.Mesh;

  private bodyMat: THREE.MeshPhysicalMaterial;
  private edgeMat: THREE.LineBasicMaterial;
  private gemMat: THREE.MeshStandardMaterial;
  private accentMat: THREE.MeshStandardMaterial;
  private tailMat: THREE.MeshPhysicalMaterial;
  private sparkleMat: THREE.PointsMaterial;
  private haloMat: THREE.SpriteMaterial;
  private flareMat: THREE.SpriteMaterial;
  private pulseMat: THREE.MeshBasicMaterial;
  private linkRingMat: THREE.MeshBasicMaterial;
  private hitMat: THREE.MeshBasicMaterial;

  private phaseOffset: number;
  private currentScale = 0.001;
  private targetReveal = 1;
  private pulseTimer = 0;
  private useDesiredPosition = false;
  private isHovered = false;
  private isSelected = false;
  private isVisited = false;
  private isFinaleActive = false;
  private isPendingLink = false;
  private isStoryHero = false;
  private isStoryBackground = false;
  private storyHeroScale = 1.76;

  constructor(
    id: string,
    index: number,
    shape: StarShapeId,
    geos: SharedStarGeometries,
    glow: GlowColorConfig,
    glowTex: THREE.Texture,
    flareTex: THREE.Texture,
  ) {
    this.id = id;
    this.geos = geos;
    this.currentShape = shape;
    this.phaseOffset = index * 1.37;

    // Translucent crystal material shared across all 3D forms
    this.bodyMat = new THREE.MeshPhysicalMaterial({
      color: glow.coreHex,
      emissive: glow.hex,
      emissiveIntensity: 0.48,
      transparent: true,
      opacity: 0.85,
      metalness: 0.35,
      roughness: 0.14,
      clearcoat: 1.0,
      clearcoatRoughness: 0.08,
      ior: 1.62,
      reflectivity: 0.95,
    });

    // Luminous crystal edges highlight
    this.edgeMat = new THREE.LineBasicMaterial({
      color: glow.coreHex,
      transparent: true,
      opacity: 0.56,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    // Radiant inner gem heart
    this.gemMat = new THREE.MeshStandardMaterial({
      color: glow.coreHex,
      emissive: glow.hex,
      emissiveIntensity: 1.25,
      metalness: 0.2,
      roughness: 0.12,
    });

    // Metallic filigree accent for rings / companion starlets
    this.accentMat = new THREE.MeshStandardMaterial({
      color: '#fde68a',
      emissive: glow.haloHex,
      emissiveIntensity: 0.36,
      metalness: 0.84,
      roughness: 0.2,
    });

    // Translucent comet plasma tail
    this.tailMat = new THREE.MeshPhysicalMaterial({
      color: glow.hex,
      emissive: glow.hex,
      emissiveIntensity: 0.82,
      transparent: true,
      opacity: 0.62,
      metalness: 0.15,
      roughness: 0.22,
      clearcoat: 0.7,
      depthWrite: false,
    });

    this.crystalGroup.add(this.bodyPivot);
    this.rebuildShapeGeometry(shape);

    // Subtle orbiting micro-particles around every 3D object
    this.sparkleMat = new THREE.PointsMaterial({
      map: glowTex,
      color: glow.coreHex,
      size: 0.14,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });
    this.sparkleCloud = new THREE.Points(geos.sparklePoints, this.sparkleMat);
    this.crystalGroup.add(this.sparkleCloud);

    this.group.add(this.crystalGroup);

    // Soft volumetric halo
    this.haloMat = new THREE.SpriteMaterial({
      map: glowTex,
      color: glow.hex,
      transparent: true,
      opacity: 0.62,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.haloSprite = new THREE.Sprite(this.haloMat);
    this.haloSprite.scale.set(1.85, 1.85, 1);
    this.group.add(this.haloSprite);

    // Crisp diffraction flare
    this.flareMat = new THREE.SpriteMaterial({
      map: flareTex,
      color: glow.coreHex,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.flareSprite = new THREE.Sprite(this.flareMat);
    this.flareSprite.scale.set(1.35, 1.35, 1);
    this.group.add(this.flareSprite);

    // Expanding selection pulse ring
    this.pulseMat = new THREE.MeshBasicMaterial({
      color: glow.hex,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.pulseRingMesh = new THREE.Mesh(geos.pulseRing, this.pulseMat);
    this.pulseRingMesh.visible = false;
    this.group.add(this.pulseRingMesh);

    // Steady link-source indicator ring (when picking 1st star in "Создать связи")
    this.linkRingMat = new THREE.MeshBasicMaterial({
      color: '#fde68a',
      transparent: true,
      opacity: 0.88,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.linkRingMesh = new THREE.Mesh(geos.pulseRing, this.linkRingMat);
    this.linkRingMesh.visible = false;
    this.linkRingMesh.scale.setScalar(1.3);
    this.group.add(this.linkRingMesh);

    // Forgiving raycast hit sphere
    this.hitMat = new THREE.MeshBasicMaterial({ visible: false });
    this.hitMesh = new THREE.Mesh(geos.hitProxy, this.hitMat);
    this.hitMesh.userData.starId = id;
    this.group.add(this.hitMesh);
  }

  private rebuildShapeGeometry(shape: StarShapeId): void {
    this.bodyPivot.clear();

    if (shape === 'comet') {
      // Crystal nucleus positioned toward top-right + swept luminous tail trailing bottom-left
      const headPack = this.geos.shapes.comet;
      const headMesh = new THREE.Mesh(headPack.body, this.bodyMat);
      headMesh.position.set(0.18, 0.16, 0);
      this.bodyPivot.add(headMesh);

      const headEdges = new THREE.LineSegments(headPack.edges, this.edgeMat);
      headEdges.position.copy(headMesh.position);
      this.bodyPivot.add(headEdges);

      const coreGem = new THREE.Mesh(this.geos.innerGem, this.gemMat);
      coreGem.position.copy(headMesh.position);
      coreGem.scale.setScalar(0.85);
      this.bodyPivot.add(coreGem);

      // Tapered 3D cone core tail pointing away from nucleus
      const coneTail = new THREE.Mesh(this.geos.cometTailCone, this.tailMat);
      coneTail.position.set(-0.08, -0.08, 0);
      coneTail.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        new THREE.Vector3(-0.72, -0.69, 0).normalize(),
      );
      this.bodyPivot.add(coneTail);

      // Swept crystalline twin-plume tail
      const plumeMesh = new THREE.Mesh(this.geos.cometPlume, this.tailMat);
      plumeMesh.position.z = -0.02;
      this.bodyPivot.add(plumeMesh);

      const plumeEdges = new THREE.LineSegments(this.geos.cometPlumeEdges, this.edgeMat);
      plumeEdges.position.z = -0.02;
      this.bodyPivot.add(plumeEdges);
      return;
    }

    if (shape === 'planet') {
      const pack = this.geos.shapes.planet;
      const planetMesh = new THREE.Mesh(pack.body, this.bodyMat);
      this.bodyPivot.add(planetMesh);

      const planetEdges = new THREE.LineSegments(pack.edges, this.edgeMat);
      this.bodyPivot.add(planetEdges);

      const coreGem = new THREE.Mesh(this.geos.innerGem, this.gemMat);
      coreGem.scale.setScalar(0.95);
      this.bodyPivot.add(coreGem);

      // Sleek flattened Saturn ring + orbiting moonlet
      const ringMesh = new THREE.Mesh(this.geos.planetRing, this.accentMat);
      ringMesh.scale.set(1, 1, 0.28);
      ringMesh.rotation.set(Math.PI * 0.36, -Math.PI * 0.14, 0.12);
      this.bodyPivot.add(ringMesh);

      const moonlet = new THREE.Mesh(this.geos.planetMoonlet, this.gemMat);
      moonlet.position.set(-0.38, 0.24, 0.18);
      this.bodyPivot.add(moonlet);
      return;
    }

    // Standard sculpted crystal shapes: star, heart, flower, moon, spark
    const pack = this.geos.shapes[shape] ?? this.geos.shapes.star;
    const bodyMesh = new THREE.Mesh(pack.body, this.bodyMat);
    this.bodyPivot.add(bodyMesh);

    const edgeLines = new THREE.LineSegments(pack.edges, this.edgeMat);
    this.bodyPivot.add(edgeLines);

    if (shape === 'flower') {
      const flowerCenter = new THREE.Mesh(this.geos.flowerCore, this.gemMat);
      flowerCenter.position.z = 0.04;
      this.bodyPivot.add(flowerCenter);
    } else if (shape === 'moon') {
      // Glowing companion starlet inside the crescent hollow
      const starlet = new THREE.Mesh(this.geos.moonStarlet, this.accentMat);
      starlet.position.set(0.24, 0.05, 0.03);
      this.bodyPivot.add(starlet);
    } else if (shape === 'spark') {
      const coreGem = new THREE.Mesh(this.geos.innerGem, this.gemMat);
      coreGem.scale.setScalar(0.76);
      this.bodyPivot.add(coreGem);

      // Pair of diagonal crystalline glints flanking the 4-pointed spark
      const moteTopRight = new THREE.Mesh(this.geos.sparkMote, this.accentMat);
      moteTopRight.position.set(0.28, 0.28, 0.06);
      this.bodyPivot.add(moteTopRight);

      const moteBottomLeft = new THREE.Mesh(this.geos.sparkMote, this.accentMat);
      moteBottomLeft.position.set(-0.28, -0.28, -0.06);
      moteBottomLeft.scale.setScalar(0.78);
      this.bodyPivot.add(moteBottomLeft);
    } else {
      const innerGem = new THREE.Mesh(this.geos.innerGem, this.gemMat);
      innerGem.position.set(0, shape === 'heart' ? 0.04 : 0, 0.02);
      this.bodyPivot.add(innerGem);
    }
  }

  public setShape(shape: StarShapeId): void {
    if (shape === this.currentShape) return;
    this.currentShape = shape;
    this.bodyPivot.rotation.set(0, 0, 0);
    this.rebuildShapeGeometry(shape);
    this.triggerPulse();
  }

  public setGlowColor(glow: GlowColorConfig): void {
    this.bodyMat.color.set(glow.coreHex);
    this.bodyMat.emissive.set(glow.hex);
    this.edgeMat.color.set(glow.coreHex);
    this.gemMat.color.set(glow.coreHex);
    this.gemMat.emissive.set(glow.hex);
    this.accentMat.emissive.set(glow.haloHex);
    this.tailMat.color.set(glow.hex);
    this.tailMat.emissive.set(glow.hex);
    this.sparkleMat.color.set(glow.coreHex);
    this.haloMat.color.set(glow.hex);
    this.flareMat.color.set(glow.coreHex);
    this.pulseMat.color.set(glow.hex);
  }

  public setInteractionState(opts: {
    hovered?: boolean;
    selected?: boolean;
    visited?: boolean;
    finale?: boolean;
    pendingLink?: boolean;
    storyHero?: boolean;
    storyBackground?: boolean;
    storyHeroScale?: number;
  }): void {
    if (opts.hovered !== undefined) this.isHovered = opts.hovered;
    if (opts.selected !== undefined) this.isSelected = opts.selected;
    if (opts.visited !== undefined) this.isVisited = opts.visited;
    if (opts.finale !== undefined) this.isFinaleActive = opts.finale;
    if (opts.pendingLink !== undefined) this.isPendingLink = opts.pendingLink;
    if (opts.storyHero !== undefined) this.isStoryHero = opts.storyHero;
    if (opts.storyBackground !== undefined) this.isStoryBackground = opts.storyBackground;
    if (opts.storyHeroScale !== undefined) this.storyHeroScale = opts.storyHeroScale;
  }

  public setTargetPosition(x: number, y: number, z: number, snap = false): void {
    this.desiredPosition.set(x, y, z);
    this.useDesiredPosition = true;
    if (snap) {
      this.group.position.set(x, y, z);
    }
  }

  public clearTargetPosition(): void {
    this.useDesiredPosition = false;
  }

  public setReveal(visibleFactor: number): void {
    this.targetReveal = Math.max(0, Math.min(1, visibleFactor));
    this.group.visible = this.targetReveal > 0.002 || this.currentScale > 0.01;
  }

  public snapReveal(visibleFactor: number): void {
    const val = Math.max(0, Math.min(1, visibleFactor));
    this.targetReveal = val;
    this.currentScale = Math.max(0.001, val);
    this.group.scale.setScalar(this.currentScale);
    this.group.visible = val > 0.002;
  }

  public snapRevealZero(): void {
    this.targetReveal = 0;
    this.currentScale = 0.001;
    this.group.scale.setScalar(0.001);
    this.group.visible = false;
  }

  public triggerPulse(): void {
    this.pulseTimer = 1.0;
    this.pulseRingMesh.visible = true;
    this.pulseRingMesh.scale.setScalar(0.8);
  }

  public update(elapsed: number, dt: number, cameraQuat: THREE.Quaternion, reducedMotion: boolean): void {
    if (this.useDesiredPosition) {
      if (reducedMotion) {
        this.group.position.copy(this.desiredPosition);
      } else {
        const posDamp = 1 - Math.exp(-5.4 * dt);
        this.group.position.lerp(this.desiredPosition, posDamp);
      }
    }

    const twinkle = reducedMotion
      ? 1
      : 0.92 + 0.08 * Math.sin(elapsed * 2.0 + this.phaseOffset);

    const roleScale = this.isStoryHero
      ? this.storyHeroScale
      : this.isStoryBackground
        ? 0.78
        : this.isPendingLink
          ? 1.28
          : this.isSelected
            ? 1.22
            : this.isHovered
              ? 1.14
              : this.isFinaleActive
                ? 1.18
                : 1.0;

    const baseTargetScale = roleScale * this.targetReveal;

    const dampFactor = reducedMotion ? 1 : 1 - Math.exp(-7.5 * dt);
    this.currentScale = THREE.MathUtils.lerp(this.currentScale, baseTargetScale, dampFactor);
    this.group.scale.setScalar(Math.max(0.001, this.currentScale));
    this.group.visible = this.targetReveal > 0.002 || this.currentScale > 0.015;

    // Gentle idle floating & smooth rotation preserving readability of silhouette
    if (!reducedMotion) {
      this.crystalGroup.position.y = Math.sin(elapsed * 1.35 + this.phaseOffset) * 0.055;
      if (this.isStoryHero) {
        this.bodyPivot.rotation.y += dt * 0.46;
        this.bodyPivot.rotation.x = Math.cos(elapsed * 0.55 + this.phaseOffset) * 0.12;
        this.bodyPivot.rotation.z =
          this.currentShape === 'spark'
            ? Math.sin(elapsed * 0.85 + this.phaseOffset) * 0.14
            : 0;
      } else if (this.isFinaleActive) {
        this.bodyPivot.rotation.y += dt * 0.24;
        this.bodyPivot.rotation.x = Math.cos(elapsed * 0.5 + this.phaseOffset) * 0.1;
        this.bodyPivot.rotation.z =
          this.currentShape === 'spark'
            ? Math.sin(elapsed * 0.75 + this.phaseOffset) * 0.1
            : 0;
      } else if (this.currentShape === 'spark') {
        this.bodyPivot.rotation.y += dt * 0.58;
        this.bodyPivot.rotation.z = Math.sin(elapsed * 0.85 + this.phaseOffset) * 0.16;
        this.bodyPivot.rotation.x = Math.cos(elapsed * 0.65 + this.phaseOffset) * 0.12;
      } else {
        const swayRange = this.currentShape === 'planet' ? 0.55 : 0.42;
        this.bodyPivot.rotation.y = Math.sin(elapsed * 0.65 + this.phaseOffset) * swayRange;
        this.bodyPivot.rotation.x = Math.cos(elapsed * 0.5 + this.phaseOffset) * 0.1;
        this.bodyPivot.rotation.z = 0;
      }
      this.sparkleCloud.rotation.z = elapsed * 0.25 + this.phaseOffset;
      this.sparkleCloud.rotation.y = elapsed * 0.18;
      this.flareMat.rotation = elapsed * 0.22 + this.phaseOffset;
    }

    // Controlled luminous crystal & halo balance (previously opened background stars stay softer)
    const boost = this.isStoryHero
      ? 1.48
      : this.isStoryBackground
        ? 0.64
        : this.isPendingLink
          ? 1.5
          : this.isSelected
            ? 1.4
            : this.isFinaleActive
              ? 1.38
              : this.isHovered
                ? 1.22
                : this.isVisited
                  ? 1.08
                  : 1.0;

    this.bodyMat.emissiveIntensity = 0.48 * boost * twinkle;
    this.gemMat.emissiveIntensity = 1.15 * boost * twinkle;
    this.edgeMat.opacity = Math.min(0.92, 0.52 * boost * twinkle);
    this.haloMat.opacity = Math.min(0.86, 0.5 * boost * twinkle);
    this.flareMat.opacity = Math.min(0.78, 0.36 * boost * twinkle);

    const haloSize =
      (this.isStoryHero
        ? 2.45
        : this.isStoryBackground
          ? 1.25
          : this.isSelected || this.isPendingLink
            ? 2.25
            : this.isFinaleActive
              ? 2.15
              : this.isHovered
                ? 2.0
                : 1.78) * twinkle;
    this.haloSprite.scale.set(haloSize, haloSize, 1);

    // Link source highlight ring
    if (this.isPendingLink) {
      this.linkRingMesh.visible = true;
      this.linkRingMesh.quaternion.copy(cameraQuat);
      const pulse = reducedMotion ? 1.3 : 1.25 + 0.12 * Math.sin(elapsed * 5);
      this.linkRingMesh.scale.setScalar(pulse);
    } else {
      this.linkRingMesh.visible = false;
    }

    // Expanding pulse ring on selection
    if (this.pulseTimer > 0) {
      this.pulseTimer = Math.max(0, this.pulseTimer - dt * 1.35);
      const progress = 1 - this.pulseTimer;
      this.pulseRingMesh.quaternion.copy(cameraQuat);
      this.pulseRingMesh.scale.setScalar(0.8 + progress * 2.1);
      this.pulseMat.opacity = Math.sin(this.pulseTimer * Math.PI) * 0.72;
      if (this.pulseTimer === 0) {
        this.pulseRingMesh.visible = false;
      }
    }
  }

  public dispose(): void {
    this.bodyMat.dispose();
    this.edgeMat.dispose();
    this.gemMat.dispose();
    this.accentMat.dispose();
    this.tailMat.dispose();
    this.sparkleMat.dispose();
    this.haloMat.dispose();
    this.flareMat.dispose();
    this.pulseMat.dispose();
    this.linkRingMat.dispose();
    this.hitMat.dispose();
  }
}
