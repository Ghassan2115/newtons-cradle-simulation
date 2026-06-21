export interface CradleState {
  time: number;
  theta: number[];
  omega: number[];
  alpha: number[];
  kineticEnergy: number;
  potentialEnergy: number;
  totalEnergy: number;
  initialEnergy: number;
  relativeEnergyError: number;
  lastCollisionVelocity: number;
}

export interface CradleConfig {
  ballCount: number;
  g: number;
  restitution: number;
  damping: number;
  masses: number[];
  radii: number[];
  lengths: number[];
  pivots: { x: number; y: number; z: number }[];
}
