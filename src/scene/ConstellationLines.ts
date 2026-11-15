import * as THREE from 'three';
import type { StarConnection } from '../types/project';

const _dir = new THREE.Vector3();
const _mid = new THREE.Vector3();
const _end = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);

interface EdgeSlot {
  id: string;
  from: string;
  to: string;
  tube: THREE.Mesh;
  hitTube: THREE.Mesh;
  line: THREE.Line;
  lineGeo: THREE.BufferGeometry;
}

export class ConstellationLines {
  public readonly group = new THREE.Group();

  private tubeUnitGeo: THREE.CylinderGeometry;
  private hitUnitGeo: THREE.CylinderGeometry;
  private tubeMat: THREE.MeshBasicMaterial;
  private selectedTubeMat: THREE.MeshBasicMaterial;
  private hitMat: THREE.MeshBasicMaterial;
  private lineMat: THREE.LineBasicMaterial;
  private selectedLineMat: THREE.LineBasicMaterial;

  private pulseSprite: THREE.Sprite;
  private pulseMat: THREE.SpriteMaterial;

  private slots: EdgeSlot[] = [];
  private positionsById = new Map<string, THREE.Vector3>();
  private connections: StarConnection[] = [];
  private selectedConnectionId: string | null = null;
  private revealProgress = 1;
  private finaleHighlight = false;
  private selectionPulseEdgeIdx = -1;
  private selectionPulseT = 0;

  constructor(tintHex: string, glowTex: THREE.Texture) {
    this.tubeUnitGeo = new THREE.CylinderGeometry(0.022, 0.022, 1, 8, 1, true);
    this.hitUnitGeo = new THREE.CylinderGeometry(0.16, 0.16, 1, 6, 1, true);

    this.tubeMat = new THREE.MeshBasicMaterial({
      color: tintHex,
      transparent: true,
      opacity: 0.44,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.selectedTubeMat = new THREE.MeshBasicMaterial({
      color: '#fde68a',
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.hitMat = new THREE.MeshBasicMaterial({ visible: false });

    this.lineMat = new THREE.LineBasicMaterial({
      color: tintHex,
      transparent: true,
      opacity: 0.72,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.selectedLineMat = new THREE.LineBasicMaterial({
      color: '#fffbeb',
      transparent: true,
      opacity: 0.98,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.pulseMat = new THREE.SpriteMaterial({
      map: glowTex,
      color: '#ffffff',
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.pulseSprite = new THREE.Sprite(this.pulseMat);
    this.pulseSprite.scale.set(0.55, 0.55, 1);
    this.pulseSprite.visible = false;
    this.group.add(this.pulseSprite);
  }

  public setTint(tintHex: string): void {
    this.lineMat.color.set(tintHex);
    this.tubeMat.color.set(tintHex);
  }

  public setRevealProgress(progress: number): void {
    this.revealProgress = Math.max(0, Math.min(1, progress));
    this.rebuildVisuals();
  }

  public setFinaleHighlight(active: boolean): void {
    this.finaleHighlight = active;
  }

  public setSelectedConnection(connectionId: string | null): void {
    if (this.selectedConnectionId === connectionId) return;
    this.selectedConnectionId = connectionId;
    this.rebuildVisuals();
  }

  public triggerSegmentPulse(starId: string): void {
    if (this.slots.length === 0) return;
    const idx = this.slots.findIndex((s) => s.from === starId || s.to === starId);
    if (idx >= 0) {
      this.selectionPulseEdgeIdx = idx;
      this.selectionPulseT = 0;
    }
  }

  public setGraph(
    positionsById: Map<string, THREE.Vector3>,
    connections: StarConnection[],
  ): void {
    this.positionsById.clear();
    for (const [id, vec] of positionsById.entries()) {
      this.positionsById.set(id, vec.clone());
    }
    this.connections = connections;
    this.syncSlotPool(connections.length);
    for (let i = 0; i < connections.length; i++) {
      this.slots[i].id = connections[i].id;
      this.slots[i].from = connections[i].from;
      this.slots[i].to = connections[i].to;
      this.slots[i].hitTube.userData.connectionId = connections[i].id;
    }
    this.rebuildVisuals();
  }

  public updatePositions(positionsById: Map<string, THREE.Vector3>): void {
    this.positionsById.clear();
    for (const [id, vec] of positionsById.entries()) {
      this.positionsById.set(id, vec.clone());
    }
    this.rebuildVisuals();
  }

  public pickConnection(raycaster: THREE.Raycaster): string | null {
    const targets: THREE.Object3D[] = [];
    for (const slot of this.slots) {
      if (slot.hitTube.visible) targets.push(slot.hitTube);
    }
    if (targets.length === 0) return null;
    const hits = raycaster.intersectObjects(targets, false);
    if (hits.length > 0) {
      return (hits[0].object.userData.connectionId as string) ?? null;
    }
    return null;
  }

  private syncSlotPool(needed: number): void {
    while (this.slots.length < needed) {
      const tube = new THREE.Mesh(this.tubeUnitGeo, this.tubeMat);
      tube.frustumCulled = false;

      const hitTube = new THREE.Mesh(this.hitUnitGeo, this.hitMat);
      hitTube.frustumCulled = false;

      const lineGeo = new THREE.BufferGeometry();
      lineGeo.setAttribute(
        'position',
        new THREE.BufferAttribute(new Float32Array(6), 3),
      );
      const line = new THREE.Line(lineGeo, this.lineMat);
      line.frustumCulled = false;

      this.group.add(tube, hitTube, line);
      this.slots.push({
        id: '',
        from: '',
        to: '',
        tube,
        hitTube,
        line,
        lineGeo,
      });
    }

    while (this.slots.length > needed) {
      const removed = this.slots.pop()!;
      this.group.remove(removed.tube, removed.hitTube, removed.line);
      removed.lineGeo.dispose();
    }
  }

  private rebuildVisuals(): void {
    const totalEdges = this.connections.length;
    if (totalEdges === 0 || this.revealProgress <= 0.001) {
      for (const slot of this.slots) {
        slot.tube.visible = false;
        slot.hitTube.visible = false;
        slot.line.visible = false;
      }
      return;
    }

    const scaled = this.revealProgress * totalEdges;

    for (let i = 0; i < totalEdges; i++) {
      const slot = this.slots[i];
      const a = this.positionsById.get(slot.from);
      const b = this.positionsById.get(slot.to);

      if (!a || !b || i >= scaled) {
        slot.tube.visible = false;
        slot.hitTube.visible = false;
        slot.line.visible = false;
        continue;
      }

      const segT = Math.min(1, scaled - i);
      _end.lerpVectors(a, b, segT);
      _dir.subVectors(_end, a);
      const len = _dir.length();

      if (len <= 0.01) {
        slot.tube.visible = false;
        slot.hitTube.visible = false;
        slot.line.visible = false;
        continue;
      }

      const isSelected = slot.id === this.selectedConnectionId;
      slot.tube.material = isSelected ? this.selectedTubeMat : this.tubeMat;
      slot.line.material = isSelected ? this.selectedLineMat : this.lineMat;

      slot.tube.visible = true;
      slot.hitTube.visible = segT >= 0.99;
      slot.line.visible = true;

      _mid.addVectors(a, _end).multiplyScalar(0.5);
      _dir.normalize();

      slot.tube.position.copy(_mid);
      slot.tube.scale.set(isSelected ? 1.85 : 1, len, isSelected ? 1.85 : 1);
      slot.tube.quaternion.setFromUnitVectors(_up, _dir);

      slot.hitTube.position.copy(_mid);
      slot.hitTube.scale.set(1, len, 1);
      slot.hitTube.quaternion.copy(slot.tube.quaternion);

      const posAttr = slot.lineGeo.attributes.position as THREE.BufferAttribute;
      posAttr.setXYZ(0, a.x, a.y, a.z);
      posAttr.setXYZ(1, _end.x, _end.y, _end.z);
      posAttr.needsUpdate = true;
    }
  }

  public update(elapsed: number, dt: number, reducedMotion: boolean): void {
    const baseOpacity = this.finaleHighlight ? 0.85 : 0.44;
    const pulse = reducedMotion ? 1 : 0.86 + 0.14 * Math.sin(elapsed * 2.2);
    this.tubeMat.opacity = baseOpacity * pulse;
    this.lineMat.opacity = Math.min(0.95, (baseOpacity + 0.25) * pulse);

    if (this.slots.length === 0 || this.revealProgress < 0.99 || reducedMotion) {
      this.pulseSprite.visible = false;
      return;
    }

    if (
      this.selectionPulseEdgeIdx >= 0 &&
      this.selectionPulseEdgeIdx < this.slots.length
    ) {
      const slot = this.slots[this.selectionPulseEdgeIdx];
      const a = this.positionsById.get(slot.from);
      const b = this.positionsById.get(slot.to);
      this.selectionPulseT += dt * 1.9;
      if (!a || !b || this.selectionPulseT >= 1) {
        this.selectionPulseEdgeIdx = -1;
      } else {
        this.pulseSprite.visible = true;
        this.pulseSprite.position.lerpVectors(a, b, this.selectionPulseT);
        this.pulseSprite.scale.setScalar(0.75);
        this.pulseMat.opacity = 0.95;
        return;
      }
    }

    // Continuous gentle light pulse gliding along the constellation edges
    const totalEdges = this.slots.length;
    const cycleSpeed = this.finaleHighlight ? 0.55 : 0.22;
    const tTotal = ((elapsed * cycleSpeed) % 1) * totalEdges;
    const edgeIdx = Math.min(totalEdges - 1, Math.floor(tTotal));
    const localT = tTotal - edgeIdx;
    const slot = this.slots[edgeIdx];
    const a = this.positionsById.get(slot.from);
    const b = this.positionsById.get(slot.to);

    if (!a || !b) {
      this.pulseSprite.visible = false;
      return;
    }

    this.pulseSprite.visible = true;
    this.pulseSprite.position.lerpVectors(a, b, localT);
    const sz = this.finaleHighlight ? 0.72 : 0.45;
    this.pulseSprite.scale.setScalar(sz);
    this.pulseMat.opacity = this.finaleHighlight ? 0.95 : 0.65;
  }

  public dispose(): void {
    for (const slot of this.slots) {
      slot.lineGeo.dispose();
    }
    this.slots = [];
    this.tubeUnitGeo.dispose();
    this.hitUnitGeo.dispose();
    this.tubeMat.dispose();
    this.selectedTubeMat.dispose();
    this.hitMat.dispose();
    this.lineMat.dispose();
    this.selectedLineMat.dispose();
    this.pulseMat.dispose();
  }
}
