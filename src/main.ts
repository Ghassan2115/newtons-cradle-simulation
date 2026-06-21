import type { CradleConfig } from './physics/Types';
import { CradleEngine } from './physics/Engine';
import { CradleRenderer } from './renderer/CradleRenderer';
import { Dashboard } from './ui/Dashboard';
import { SoundManager } from './ui/SoundManager';
import { RK4Integrator } from './physics/integrators/RK4';
import { VelocityVerletIntegrator } from './physics/integrators/VelocityVerlet';

let engine: CradleEngine;
let renderer: CradleRenderer;
let dashboard: Dashboard;
let soundManager: SoundManager;

let isPlaying = true;
let speedFactor = 1.0;
let physicsDt = 0.001;
let accumulator = 0.0;
let lastTime = 0;
let fpsLastTime = 0;
let fpsCount = 0;
let currentFps = 60;
let chartFrameCount = 0;

let initialAngles: number[] = [];

function createConfig(ballCount: number, masses?: number[], radii?: number[], lengths?: number[]): CradleConfig {
  const finalMasses = masses || new Array<number>(ballCount).fill(0.05);
  const finalRadii = radii || new Array<number>(ballCount).fill(0.015);
  const finalLengths = lengths || new Array<number>(ballCount).fill(0.25);

  const pivots: { x: number; y: number; z: number }[] = [];
  let totalWidth = 0;
  for (let i = 0; i < ballCount; i++) {
    totalWidth += finalRadii[i] * 2;
  }

  let startX = -totalWidth / 2;
  let currentX = startX;
  for (let i = 0; i < ballCount; i++) {
    pivots.push({
      x: currentX + finalRadii[i],
      y: finalLengths[i] + finalRadii[i] + 0.002,
      z: 0,
    });
    currentX += finalRadii[i] * 2;
  }

  const restitutionInput = document.getElementById('restitution-range') as HTMLInputElement;
  const dampingInput = document.getElementById('damping-range') as HTMLInputElement;
  const gravityInput = document.getElementById('gravity-range') as HTMLInputElement;

  return {
    ballCount,
    g: gravityInput ? parseFloat(gravityInput.value) : 9.81,
    restitution: restitutionInput ? parseFloat(restitutionInput.value) : 0.99,
    damping: dampingInput ? parseFloat(dampingInput.value) : 0.01,
    masses: finalMasses,
    radii: finalRadii,
    lengths: finalLengths,
    pivots,
  };
}

function initSimulation(): void {

  const container = document.getElementById('canvas3d')!;
  renderer = new CradleRenderer(container);
  dashboard = new Dashboard();
  soundManager = new SoundManager();

  bindUiEvents();

  loadPreset('one-swing');

  lastTime = performance.now();
  fpsLastTime = lastTime;
  requestAnimationFrame(simulationLoop);
}

function simulationLoop(currentTime: number): void {

  let delta = (currentTime - lastTime) / 1000;
  lastTime = currentTime;

  if (delta > 0.1) delta = 0.1;

  fpsCount++;
  if (currentTime - fpsLastTime >= 1000) {
    currentFps = (fpsCount * 1000) / (currentTime - fpsLastTime);
    fpsCount = 0;
    fpsLastTime = currentTime;
  }

  const currentConfig = engine.getConfig();

  let prevTheta = [...engine.getState().theta];
  let prevOmega = [...engine.getState().omega];
  let prevAlpha = [...engine.getState().alpha];

  if (isPlaying) {

    accumulator += delta * speedFactor;

    const maxSteps = 16;
    let steps = 0;

    while (accumulator >= physicsDt && steps < maxSteps) {
      prevTheta = [...engine.getState().theta];
      prevOmega = [...engine.getState().omega];
      prevAlpha = [...engine.getState().alpha];
      engine.step(physicsDt);
      accumulator -= physicsDt;
      steps++;

      if (engine.getState().lastCollisionVelocity > 0) {
        soundManager.playClick(engine.getState().lastCollisionVelocity);
      }
    }

    if (accumulator > physicsDt * 4) {
      accumulator = 0;
    }
  }

  const alpha = isPlaying ? accumulator / physicsDt : 1.0;

  const state = engine.getState();
  renderer.update(
    state.theta,
    state.omega,
    state.alpha,
    currentConfig,
    prevTheta,
    prevOmega,
    prevAlpha,
    alpha
  );
  renderer.render();

  dashboard.updateStatus(state, currentFps);

  if (isPlaying) {
    dashboard.addEnergySample(state.kineticEnergy, state.potentialEnergy, state.totalEnergy);
  }

  chartFrameCount++;
  if (chartFrameCount % 6 === 0) {
    dashboard.drawChart();
  }

  requestAnimationFrame(simulationLoop);
}

function updateRendererSettings(): void {
  const colorSelect = document.getElementById('color-scheme-select') as HTMLSelectElement;
  const chkSound = document.getElementById('chk-sound') as HTMLInputElement;
  const chkVectors = document.getElementById('chk-vectors') as HTMLInputElement;
  const chkTrails = document.getElementById('chk-trails') as HTMLInputElement;

  if (colorSelect) renderer.setColorScheme(colorSelect.value);
  if (chkSound) soundManager.setEnabled(chkSound.checked);
  if (chkVectors) renderer.setShowVectors(chkVectors.checked);
  if (chkTrails) renderer.setShowTrails(chkTrails.checked);
}

function loadPreset(presetName: string, customBallCount?: number): void {
  isPlaying = false;
  document.getElementById('btn-play-pause')!.textContent = 'تشغيل';
  dashboard.resetChart();

  const ballCountRange = document.getElementById('ball-count-range') as HTMLInputElement;
  const ballCount = customBallCount !== undefined ? customBallCount : (ballCountRange ? parseInt(ballCountRange.value) : 5);

  let config: CradleConfig;

  switch (presetName) {
    case 'one-swing':
      config = createConfig(ballCount);
      initialAngles = new Array<number>(ballCount).fill(0);
      if (ballCount > 0) initialAngles[0] = -0.35;
      break;

    case 'two-swing':
      config = createConfig(ballCount);
      initialAngles = new Array<number>(ballCount).fill(0);
      if (ballCount > 0) initialAngles[0] = -0.35;
      if (ballCount > 1) initialAngles[1] = -0.35;
      break;

    case 'chaos-mass':
      {
        const masses: number[] = [];
        const radii: number[] = [];
        for (let i = 0; i < ballCount; i++) {
          const mass = 0.02 + i * (0.08 / Math.max(1, ballCount - 1));
          masses.push(mass);
          const rho = 7850;
          const radius = Math.pow((3 * mass) / (4 * Math.PI * rho), 1 / 3);
          radii.push(radius);
        }
        config = createConfig(ballCount, masses, radii);
        initialAngles = new Array<number>(ballCount).fill(0);
        if (ballCount > 0) initialAngles[0] = -0.35;
      }
      break;

    case 'newton-heavy':
      {
        const masses = new Array<number>(ballCount).fill(0.05);
        if (ballCount > 0) masses[0] = 0.25;
        const radii = new Array<number>(ballCount).fill(0.015);
        if (ballCount > 0) {
          const rho = 7850;
          radii[0] = Math.pow((3 * 0.25) / (4 * Math.PI * rho), 1 / 3);
        }
        config = createConfig(ballCount, masses, radii);
        initialAngles = new Array<number>(ballCount).fill(0);
        if (ballCount > 0) initialAngles[0] = -0.35;
      }
      break;

    case 'double-side':
      config = createConfig(ballCount);
      initialAngles = new Array<number>(ballCount).fill(0);
      if (ballCount > 0) initialAngles[0] = -0.35;
      if (ballCount > 1) initialAngles[ballCount - 1] = 0.35;
      break;

    case 'vacuum-perfect':
      config = createConfig(ballCount);
      config.restitution = 1.0;
      config.damping = 0.0;
      initialAngles = new Array<number>(ballCount).fill(0);
      if (ballCount > 0) initialAngles[0] = -0.35;

      (document.getElementById('restitution-range') as HTMLInputElement).value = '1.0';
      (document.getElementById('damping-range') as HTMLInputElement).value = '0.0';
      break;

    default:
      config = createConfig(ballCount);
      initialAngles = new Array<number>(ballCount).fill(0);
      if (ballCount > 0) initialAngles[0] = -0.35;
  }

  if (ballCountRange) {
    ballCountRange.value = config.ballCount.toString();
  }
  dashboard.updateLabels(config, speedFactor);

  const activeIntegratorVal = (document.getElementById('integrator-select') as HTMLSelectElement).value;
  const integrator = activeIntegratorVal === 'rk4' ? new RK4Integrator() : new VelocityVerletIntegrator();

  engine = new CradleEngine(initialAngles, config, integrator);

  updateRendererSettings();
  renderer.rebuildCradle(config);

  dashboard.rebuildBallControls(config, initialAngles, (idx, mass, angle) => {

    const currentMasses = [...engine.getConfig().masses];
    currentMasses[idx] = mass;
    initialAngles[idx] = angle;

    const currentRadii = [...engine.getConfig().radii];
    const rho = 7850;
    currentRadii[idx] = Math.pow((3 * mass) / (4 * Math.PI * rho), 1 / 3);

    const nextConfig = createConfig(engine.getConfig().ballCount, currentMasses, currentRadii, engine.getConfig().lengths);
    engine.updateConfig(nextConfig);
    renderer.rebuildCradle(nextConfig);
    resetSimulation();
  });

  const state = engine.getState();
  dashboard.addEnergySample(state.kineticEnergy, state.potentialEnergy, state.totalEnergy);
  dashboard.drawChart();
}

function resetSimulation(): void {
  const currentConfig = engine.getConfig();
  const activeIntegratorVal = (document.getElementById('integrator-select') as HTMLSelectElement).value;
  const integrator = activeIntegratorVal === 'rk4' ? new RK4Integrator() : new VelocityVerletIntegrator();

  engine = new CradleEngine(initialAngles, currentConfig, integrator);
  dashboard.resetChart();
  accumulator = 0;

  const state = engine.getState();
  dashboard.addEnergySample(state.kineticEnergy, state.potentialEnergy, state.totalEnergy);
  dashboard.drawChart();
}

function bindUiEvents(): void {

  const presetSelect = document.getElementById('preset-select') as HTMLSelectElement;
  presetSelect.addEventListener('change', () => loadPreset(presetSelect.value));

  const ballCountRange = document.getElementById('ball-count-range') as HTMLInputElement;
  ballCountRange.addEventListener('input', () => {
    const count = parseInt(ballCountRange.value);
    loadPreset(presetSelect.value, count);
  });

  const integratorSelect = document.getElementById('integrator-select') as HTMLSelectElement;
  integratorSelect.addEventListener('change', () => {
    const activeVal = integratorSelect.value;
    const integrator = activeVal === 'rk4' ? new RK4Integrator() : new VelocityVerletIntegrator();
    engine.setIntegrator(integrator);
  });

  const restitutionRange = document.getElementById('restitution-range') as HTMLInputElement;
  restitutionRange.addEventListener('input', () => {
    const val = parseFloat(restitutionRange.value);
    engine.updateConfig({ restitution: val });
    dashboard.updateLabels(engine.getConfig(), speedFactor);
  });

  const dampingRange = document.getElementById('damping-range') as HTMLInputElement;
  dampingRange.addEventListener('input', () => {
    const val = parseFloat(dampingRange.value);
    engine.updateConfig({ damping: val });
    dashboard.updateLabels(engine.getConfig(), speedFactor);
  });

  const gravityRange = document.getElementById('gravity-range') as HTMLInputElement;
  gravityRange.addEventListener('input', () => {
    const val = parseFloat(gravityRange.value);
    engine.updateConfig({ g: val });
    dashboard.updateLabels(engine.getConfig(), speedFactor);
  });

  const speedRange = document.getElementById('speed-range') as HTMLInputElement;
  speedRange.addEventListener('input', () => {
    speedFactor = parseFloat(speedRange.value);
    dashboard.updateLabels(engine.getConfig(), speedFactor);
  });

  const colorSchemeSelect = document.getElementById('color-scheme-select') as HTMLSelectElement;
  colorSchemeSelect.addEventListener('change', () => {
    renderer.setColorScheme(colorSchemeSelect.value);
    renderer.rebuildCradle(engine.getConfig());
  });

  const chkSound = document.getElementById('chk-sound') as HTMLInputElement;
  chkSound.addEventListener('change', () => {
    soundManager.setEnabled(chkSound.checked);
  });

  const chkVectors = document.getElementById('chk-vectors') as HTMLInputElement;
  chkVectors.addEventListener('change', () => {
    renderer.setShowVectors(chkVectors.checked);
  });

  const chkTrails = document.getElementById('chk-trails') as HTMLInputElement;
  chkTrails.addEventListener('change', () => {
    renderer.setShowTrails(chkTrails.checked);
  });

  const btnPlayPause = document.getElementById('btn-play-pause')!;
  btnPlayPause.addEventListener('click', () => {
    isPlaying = !isPlaying;
    btnPlayPause.textContent = isPlaying ? 'إيقاف مؤقت' : 'تشغيل';
  });

  const btnStep = document.getElementById('btn-step')!;
  btnStep.addEventListener('click', () => {
    isPlaying = false;
    btnPlayPause.textContent = 'تشغيل';
    engine.step(physicsDt);
    resetAccumulator();
  });

  const btnReset = document.getElementById('btn-reset')!;
  btnReset.addEventListener('click', () => resetSimulation());

  const layout = document.querySelector('.simulation-layout')!;
  const btnToggleSidebar = document.getElementById('btn-toggle-sidebar')!;
  const btnCloseSidebar = document.getElementById('btn-close-sidebar')!;
  const sidebarBackdrop = document.getElementById('sidebar-backdrop')!;

  btnToggleSidebar.addEventListener('click', () => {
    if (window.innerWidth <= 900) {
      layout.classList.toggle('sidebar-open');
      layout.classList.remove('sidebar-collapsed');
    } else {
      layout.classList.toggle('sidebar-collapsed');
      layout.classList.remove('sidebar-open');
    }
  });

  btnCloseSidebar.addEventListener('click', () => {
    layout.classList.remove('sidebar-open');
  });

  sidebarBackdrop.addEventListener('click', () => {
    layout.classList.remove('sidebar-open');
  });
}

function resetAccumulator(): void {
  accumulator = 0;
}

window.addEventListener('DOMContentLoaded', initSimulation);
