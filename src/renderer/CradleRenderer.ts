import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { CradleConfig } from '../physics/Types';

export class CradleRenderer {
  private container: HTMLElement;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private controls!: OrbitControls;

  private ballsMesh: THREE.Mesh[] = [];
  private lines: THREE.Line[] = [];
  private frameGroup!: THREE.Group;
  private basePlate!: THREE.Mesh;

  private colorScheme: string = 'energy';
  private showVectors: boolean = false;
  private showTrails: boolean = false;

  private velocityArrows: THREE.ArrowHelper[] = [];
  private accelerationArrows: THREE.ArrowHelper[] = [];
  
  private trails: THREE.Line[] = [];
  private trailGeometries: THREE.BufferGeometry[] = [];
  private trailHistory: THREE.Vector3[][] = [];

  constructor(container: HTMLElement) {
    this.container = container;
    this.initScene();
    this.initLights();
    this.initEnvironment();
    this.handleResize();
  }

  private initScene(): void {

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xfaf9f0);
    this.scene.fog = new THREE.FogExp2(0xfaf9f0, 0.15);

    this.camera = new THREE.PerspectiveCamera(
      45,
      this.container.clientWidth / this.container.clientHeight,
      0.01,
      10
    );
    this.camera.position.set(0, 0.15, 0.65);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.BasicShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.05;
    this.controls.minDistance = 0.1;
    this.controls.maxDistance = 2.0;
  }

  private initLights(): void {

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.55);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
    dirLight.position.set(0.3, 0.8, 0.4);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 512;
    dirLight.shadow.mapSize.height = 512;
    dirLight.shadow.camera.near = 0.1;
    dirLight.shadow.camera.far = 2.0;
    const d = 0.3;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    dirLight.shadow.bias = -0.0005;
    this.scene.add(dirLight);

    const accentLight = new THREE.PointLight(0x88bbff, 2.5, 1.5);
    accentLight.position.set(-0.3, 0.3, 0.3);
    this.scene.add(accentLight);
  }

  private initEnvironment(): void {

    const baseGeo = new THREE.BoxGeometry(0.5, 0.015, 0.25);
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x8a5229,
      roughness: 0.7,
      metalness: 0.05,
    });
    this.basePlate = new THREE.Mesh(baseGeo, baseMat);
    this.basePlate.position.y = -0.0075;
    this.basePlate.receiveShadow = true;
    this.scene.add(this.basePlate);

    this.frameGroup = new THREE.Group();
    this.scene.add(this.frameGroup);
  }

  public setColorScheme(scheme: string): void {
    this.colorScheme = scheme;
  }

  public setShowVectors(show: boolean): void {
    this.showVectors = show;
  }

  public setShowTrails(show: boolean): void {
    this.showTrails = show;
    if (!show) {

      this.trailHistory.forEach((history) => history.length = 0);
    }
  }

  
  public rebuildCradle(config: CradleConfig): void {

    this.ballsMesh.forEach((mesh) => this.scene.remove(mesh));
    this.lines.forEach((line) => this.scene.remove(line));
    this.ballsMesh = [];
    this.lines = [];

    while (this.frameGroup.children.length > 0) {
      this.frameGroup.remove(this.frameGroup.children[0]);
    }

    this.velocityArrows.forEach((arrow) => this.scene.remove(arrow));
    this.accelerationArrows.forEach((arrow) => this.scene.remove(arrow));
    this.velocityArrows = [];
    this.accelerationArrows = [];

    this.trails.forEach((trail) => this.scene.remove(trail));
    this.trails = [];
    this.trailGeometries = [];
    this.trailHistory = [];

    const n = config.ballCount;

    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0x888899,
      linewidth: 1,
    });

    let metalness = 1.0;
    let roughness = 0.05;
    if (this.colorScheme === 'rainbow') {
      metalness = 0.4;
      roughness = 0.2;
    } else if (this.colorScheme === 'energy') {
      metalness = 0.6;
      roughness = 0.15;
    } else if (this.colorScheme === 'velocity') {
      metalness = 0.8;
      roughness = 0.1;
    }

    const rainbowColors = [0xff5555, 0xffaa00, 0xffee00, 0x55ff55, 0x00e5ff, 0x5555ff, 0xff00aa, 0xaa00ff];

    for (let i = 0; i < n; i++) {

      const ballGeo = new THREE.SphereGeometry(config.radii[i], 24, 24);
      
      let defaultColor = 0xcccccc;
      if (this.colorScheme === 'rainbow') {
        defaultColor = rainbowColors[i % rainbowColors.length];
      } else if (this.colorScheme === 'energy') {
        defaultColor = 0x222233;
      } else if (this.colorScheme === 'velocity') {
        defaultColor = 0x111144;
      }

      const ballMaterial = new THREE.MeshStandardMaterial({
        color: defaultColor,
        metalness: metalness,
        roughness: roughness,
      });

      const ballMesh = new THREE.Mesh(ballGeo, ballMaterial);
      ballMesh.castShadow = true;
      ballMesh.receiveShadow = true;
      this.scene.add(ballMesh);
      this.ballsMesh.push(ballMesh);

      const lineGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(config.pivots[i].x, config.pivots[i].y, 0.04),
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(config.pivots[i].x, config.pivots[i].y, -0.04),
      ]);
      const line = new THREE.Line(lineGeo, lineMaterial);
      this.scene.add(line);
      this.lines.push(line);

      const velArrow = new THREE.ArrowHelper(
        new THREE.Vector3(1, 0, 0),
        new THREE.Vector3(0, 0, 0),
        0.001,
        0x00ff66,
        0.012,
        0.005
      );
      velArrow.visible = this.showVectors;
      this.scene.add(velArrow);
      this.velocityArrows.push(velArrow);

      const accArrow = new THREE.ArrowHelper(
        new THREE.Vector3(0, -1, 0),
        new THREE.Vector3(0, 0, 0),
        0.001,
        0xff0055,
        0.012,
        0.005
      );
      accArrow.visible = this.showVectors;
      this.scene.add(accArrow);
      this.accelerationArrows.push(accArrow);

      const maxTrailPoints = 60;
      const trailMat = new THREE.LineBasicMaterial({
        color: defaultColor,
        transparent: true,
        opacity: 0.45,
        linewidth: 1.5,
      });
      const trailGeo = new THREE.BufferGeometry();
      const trailPositions = new Float32Array(maxTrailPoints * 3);
      trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
      
      const trailLine = new THREE.Line(trailGeo, trailMat);
      trailLine.visible = this.showTrails;
      this.scene.add(trailLine);
      this.trails.push(trailLine);
      this.trailGeometries.push(trailGeo);
      this.trailHistory.push([]);
    }

    const frameMaterial = new THREE.MeshStandardMaterial({
      color: 0x9999aa,
      metalness: 0.9,
      roughness: 0.15,
    });

    const minX = config.pivots[0].x - 0.04;
    const maxX = config.pivots[n - 1].x + 0.04;
    const frameHeight = config.pivots[0].y;
    const zOffset = 0.04;

    const pillarGeo = new THREE.CylinderGeometry(0.006, 0.006, frameHeight, 16);
    
    const p1 = new THREE.Mesh(pillarGeo, frameMaterial);
    p1.position.set(minX, frameHeight / 2, zOffset);
    p1.castShadow = true;
    this.frameGroup.add(p1);

    const p2 = new THREE.Mesh(pillarGeo, frameMaterial);
    p2.position.set(minX, frameHeight / 2, -zOffset);
    p2.castShadow = true;
    this.frameGroup.add(p2);

    const p3 = new THREE.Mesh(pillarGeo, frameMaterial);
    p3.position.set(maxX, frameHeight / 2, zOffset);
    p3.castShadow = true;
    this.frameGroup.add(p3);

    const p4 = new THREE.Mesh(pillarGeo, frameMaterial);
    p4.position.set(maxX, frameHeight / 2, -zOffset);
    p4.castShadow = true;
    this.frameGroup.add(p4);

    const railLengthX = maxX - minX;
    const railGeoX = new THREE.CylinderGeometry(0.006, 0.006, railLengthX, 16);
    railGeoX.rotateZ(Math.PI / 2);

    const rx1 = new THREE.Mesh(railGeoX, frameMaterial);
    rx1.position.set((minX + maxX) / 2, frameHeight, zOffset);
    rx1.castShadow = true;
    this.frameGroup.add(rx1);

    const rx2 = new THREE.Mesh(railGeoX, frameMaterial);
    rx2.position.set((minX + maxX) / 2, frameHeight, -zOffset);
    rx2.castShadow = true;
    this.frameGroup.add(rx2);

    const railGeoZ = new THREE.CylinderGeometry(0.006, 0.006, zOffset * 2, 16);
    railGeoZ.rotateX(Math.PI / 2);

    const rz1 = new THREE.Mesh(railGeoZ, frameMaterial);
    rz1.position.set(minX, frameHeight, 0);
    rz1.castShadow = true;
    this.frameGroup.add(rz1);

    const rz2 = new THREE.Mesh(railGeoZ, frameMaterial);
    rz2.position.set(maxX, frameHeight, 0);
    rz2.castShadow = true;
    this.frameGroup.add(rz2);
  }

  
  public update(
    theta: number[],
    omega: number[],
    alphaPhysics: number[],
    config: CradleConfig,
    prevTheta?: number[],
    prevOmega?: number[],
    prevAlphaPhysics?: number[],
    alpha: number = 1.0
  ): void {
    const n = config.ballCount;
    const rainbowColors = [0xff5555, 0xffaa00, 0xffee00, 0x55ff55, 0x00e5ff, 0x5555ff, 0xff00aa, 0xaa00ff];

    for (let i = 0; i < n; i++) {
      if (i >= this.ballsMesh.length) continue;

      let t = theta[i];
      if (prevTheta && prevTheta.length === n) {
        t = prevTheta[i] * (1.0 - alpha) + theta[i] * alpha;
      }

      let w = omega[i];
      if (prevOmega && prevOmega.length === n) {
        w = prevOmega[i] * (1.0 - alpha) + omega[i] * alpha;
      }

      let a = alphaPhysics[i];
      if (prevAlphaPhysics && prevAlphaPhysics.length === n) {
        a = prevAlphaPhysics[i] * (1.0 - alpha) + alphaPhysics[i] * alpha;
      }

      const x = config.pivots[i].x + config.lengths[i] * Math.sin(t);
      const y = config.pivots[i].y - config.lengths[i] * Math.cos(t);
      const z = 0;

      this.ballsMesh[i].position.set(x, y, z);

      const mat = this.ballsMesh[i].material as THREE.MeshStandardMaterial;
      if (this.colorScheme === 'chrome') {
        mat.color.setHex(0xcccccc);
      } else if (this.colorScheme === 'rainbow') {
        mat.color.setHex(rainbowColors[i % rainbowColors.length]);
      } else if (this.colorScheme === 'energy') {

        const h = 1 - Math.cos(t);
        const peFactor = Math.min(1.0, h / 0.3);
        
        const speed = Math.abs(config.lengths[i] * w);
        const keFactor = Math.min(1.0, speed / 1.5);

        const c = new THREE.Color(0x222233);
        const cyanColor = new THREE.Color(0x00e5ff);
        const pinkColor = new THREE.Color(0xff00aa);
        
        c.lerp(cyanColor, peFactor);
        c.lerp(pinkColor, keFactor);
        mat.color.copy(c);
      } else if (this.colorScheme === 'velocity') {

        const speed = Math.abs(config.lengths[i] * w);
        const velFactor = Math.min(1.0, speed / 1.5);

        const c = new THREE.Color(0x111144);
        const heatColor = new THREE.Color(0xff3300);
        
        c.lerp(heatColor, velFactor);
        mat.color.copy(c);
      }

      const line = this.lines[i];
      const positions = line.geometry.attributes.position.array as Float32Array;

      positions[0] = config.pivots[i].x;
      positions[1] = config.pivots[i].y;
      positions[2] = 0.04;

      positions[3] = x;
      positions[4] = y;
      positions[5] = z;

      positions[6] = config.pivots[i].x;
      positions[7] = config.pivots[i].y;
      positions[8] = -0.04;

      line.geometry.attributes.position.needsUpdate = true;

      if (this.showVectors) {

        const vx = config.lengths[i] * w * Math.cos(t);
        const vy = config.lengths[i] * w * Math.sin(t);
        const vLength = Math.sqrt(vx * vx + vy * vy);

        const ax = -config.lengths[i] * w * w * Math.sin(t) + config.lengths[i] * a * Math.cos(t);
        const ay = config.lengths[i] * w * w * Math.cos(t) + config.lengths[i] * a * Math.sin(t);
        const aLength = Math.sqrt(ax * ax + ay * ay);

        const velArrow = this.velocityArrows[i];
        velArrow.position.set(x, y, 0);
        if (vLength > 1e-4) {
          velArrow.visible = true;
          velArrow.setDirection(new THREE.Vector3(vx / vLength, vy / vLength, 0));
          velArrow.setLength(vLength * 0.12, 0.012, 0.005);
        } else {
          velArrow.visible = false;
        }

        const accArrow = this.accelerationArrows[i];
        accArrow.position.set(x, y, 0);
        if (aLength > 1e-3) {
          accArrow.visible = true;
          accArrow.setDirection(new THREE.Vector3(ax / aLength, ay / aLength, 0));
          accArrow.setLength(aLength * 0.015, 0.012, 0.005);
        } else {
          accArrow.visible = false;
        }
      } else {
        this.velocityArrows[i].visible = false;
        this.accelerationArrows[i].visible = false;
      }

      if (this.showTrails) {
        const history = this.trailHistory[i];
        history.push(new THREE.Vector3(x, y, 0));
        
        const maxTrailPoints = 60;
        if (history.length > maxTrailPoints) {
          history.shift();
        }

        const trailGeo = this.trailGeometries[i];
        const trailPositions = trailGeo.attributes.position.array as Float32Array;

        for (let k = 0; k < maxTrailPoints; k++) {
          const point = history[k] || history[history.length - 1] || new THREE.Vector3(x, y, 0);
          trailPositions[k * 3] = point.x;
          trailPositions[k * 3 + 1] = point.y;
          trailPositions[k * 3 + 2] = point.z;
        }
        trailGeo.attributes.position.needsUpdate = true;
        this.trails[i].visible = true;

        const currentBallColor = (this.ballsMesh[i].material as THREE.MeshStandardMaterial).color;
        (this.trails[i].material as THREE.LineBasicMaterial).color.copy(currentBallColor);
      } else {
        this.trails[i].visible = false;
      }
    }
  }

  
  public render(): void {
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  public triggerResize(): void {
    if (!this.container || !this.camera || !this.renderer) return;
    this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
  }

  private handleResize(): void {
    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(() => this.triggerResize());
    });
    resizeObserver.observe(this.container);
  }
}
