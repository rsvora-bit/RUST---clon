import type { BuildCandidate, ItemId, PieceType, Structure, Vec3 } from '../core/types';
import { BUILD, PLAYER } from '../config/balance';
import { BUILDING_RULES } from '../config/gameplay';

export interface PieceDefinition { name: string; cost: Partial<Record<ItemId, number>> }
export const PIECES: Record<PieceType, PieceDefinition> = {
  foundation: { name: 'Foundation', cost: { wood: 60, stone: 45 } },
  wall: { name: 'Wall', cost: { wood: 45 } },
  doorway: { name: 'Doorway', cost: { wood: 35 } },
  floor: { name: 'Floor', cost: { wood: 45 } },
  roof: { name: 'Roof', cost: { wood: 45 } },
  door: { name: 'Wooden door', cost: { wood: 35, metal: 5 } },
};

export interface Socket {
  id: string;
  parentId: string;
  position: Vec3;
  rotation: number;
  accepts: PieceType[];
}

const edgeDirections = [{ x: 0, z: -1, yaw: 0 }, { x: 1, z: 0, yaw: -Math.PI / 2 }, { x: 0, z: 1, yaw: Math.PI }, { x: -1, z: 0, yaw: Math.PI / 2 }];
const distance = (a: Vec3, b: Vec3): number => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const near = (a: number, b: number): boolean => Math.abs(a - b) < BUILDING_RULES.COLLISION_EPSILON;
export const normalizeRotation = (yaw: number): number => Math.atan2(Math.sin(yaw), Math.cos(yaw));

function transform(parent: Structure, x: number, y: number, z: number): Vec3 {
  const c = Math.cos(parent.rotation), s = Math.sin(parent.rotation);
  return { x: parent.position.x + x * c + z * s, y: parent.position.y + y, z: parent.position.z - x * s + z * c };
}

/** Every attachment is transformed from a parent's local space; no world-grid rounding. */
export function getSockets(structure: Structure): Socket[] {
  const sockets: Socket[] = [];
  const socket = (name: string, position: Vec3, rotation: number, accepts: PieceType[]): void => {
    sockets.push({ id: `${structure.id}:${name}`, parentId: structure.id, position, rotation: normalizeRotation(rotation), accepts });
  };
  if (structure.pieceType === 'foundation' || structure.pieceType === 'floor') {
    const top = structure.pieceType === 'foundation' ? BUILD.FOUNDATION_HEIGHT : BUILD.THICKNESS;
    edgeDirections.forEach((edge, i) => {
      socket(`edge:${i}`, transform(structure, edge.x * BUILD.SIZE / 2, top, edge.z * BUILD.SIZE / 2), structure.rotation + edge.yaw, ['wall', 'doorway']);
      if (structure.pieceType === 'foundation') {
        socket(`adjacent:${i}`, transform(structure, edge.x * BUILD.SIZE, 0, edge.z * BUILD.SIZE), structure.rotation, ['foundation']);
      } else {
        socket(`adjacent:${i}`, transform(structure, edge.x * BUILD.SIZE, 0, edge.z * BUILD.SIZE), structure.rotation, ['floor', 'roof']);
      }
    });
  }
  if (structure.pieceType === 'wall' || structure.pieceType === 'doorway') {
    socket('ceiling', transform(structure, 0, BUILD.WALL_HEIGHT, BUILD.SIZE / 2), structure.rotation, ['floor', 'roof']);
    if (structure.pieceType === 'doorway') socket('door', { ...structure.position }, structure.rotation, ['door']);
  }
  if (structure.pieceType === 'roof') {
    edgeDirections.forEach((edge,i)=>socket(`adjacent:${i}`,transform(structure,edge.x*BUILD.SIZE,0,edge.z*BUILD.SIZE),structure.rotation,['roof']));
  }
  return sockets;
}

type Footprint = { x: number; z: number; halfX: number; halfZ: number; rotation: number; lowY: number; highY: number };
function footprint(piece: Pick<Structure, 'pieceType' | 'position' | 'rotation'>): Footprint {
  const thin = piece.pieceType === 'wall' || piece.pieceType === 'doorway' || piece.pieceType === 'door';
  const height = piece.pieceType === 'foundation' ? BUILD.FOUNDATION_HEIGHT : thin ? BUILD.WALL_HEIGHT : BUILD.THICKNESS;
  return { x: piece.position.x, z: piece.position.z, halfX: (piece.pieceType === 'door' ? BUILD.DOOR_WIDTH : BUILD.SIZE) / 2, halfZ: thin ? BUILD.THICKNESS / 2 : BUILD.SIZE / 2, rotation: piece.rotation, lowY: piece.position.y, highY: piece.position.y + height };
}

/** Separating-axis test on oriented X/Z footprints, with vertical intervals. */
function overlaps(a: Footprint, b: Footprint): boolean {
  const epsilon = BUILDING_RULES.COLLISION_EPSILON;
  if (a.highY <= b.lowY + epsilon || b.highY <= a.lowY + epsilon) return false;
  const aX = { x: Math.cos(a.rotation), z: -Math.sin(a.rotation) };
  const aZ = { x: Math.sin(a.rotation), z: Math.cos(a.rotation) };
  const bX = { x: Math.cos(b.rotation), z: -Math.sin(b.rotation) };
  const bZ = { x: Math.sin(b.rotation), z: Math.cos(b.rotation) };
  for (const axis of [aX, aZ, bX, bZ]) {
    const delta = Math.abs((b.x - a.x) * axis.x + (b.z - a.z) * axis.z);
    const aRadius = a.halfX * Math.abs(aX.x * axis.x + aX.z * axis.z) + a.halfZ * Math.abs(aZ.x * axis.x + aZ.z * axis.z);
    const bRadius = b.halfX * Math.abs(bX.x * axis.x + bX.z * axis.z) + b.halfZ * Math.abs(bZ.x * axis.x + bZ.z * axis.z);
    if (delta >= aRadius + bRadius - epsilon) return false;
  }
  return true;
}

/** Shared structural validation is repeated at placement, after preview selection. */
/** Prevent a wall or door from being committed through the player's capsule.
 * Foundations can safely be placed under the player's feet, while elevated
 * floors and roofs naturally sit outside the capsule's vertical interval. */
export function placementIntersectsPlayer(candidate: BuildCandidate, playerPos: Vec3): boolean {
  if (candidate.pieceType === 'foundation' || candidate.pieceType === 'floor' || candidate.pieceType === 'roof') return false;
  const f = footprint(candidate);
  const dx = playerPos.x - f.x, dz = playerPos.z - f.z;
  const c = Math.cos(f.rotation), s = Math.sin(f.rotation);
  const localX = dx * c - dz * s, localZ = dx * s + dz * c;
  const closestX = Math.max(-f.halfX, Math.min(f.halfX, localX));
  const closestZ = Math.max(-f.halfZ, Math.min(f.halfZ, localZ));
  const horizontal = Math.hypot(localX - closestX, localZ - closestZ) <= PLAYER.RADIUS + BUILDING_RULES.COLLISION_EPSILON;
  const vertical = playerPos.y < f.highY - BUILDING_RULES.COLLISION_EPSILON && playerPos.y + PLAYER.HEIGHT > f.lowY + BUILDING_RULES.COLLISION_EPSILON;
  return horizontal && vertical;
}

export function validateStructurePlacement(candidate: BuildCandidate, structures: Structure[], playerPos?: Vec3): string | null {
  if (!Object.hasOwn(PIECES, candidate.pieceType)) return 'Unknown building piece';
  if (![candidate.position.x, candidate.position.y, candidate.position.z, candidate.rotation].every(Number.isFinite)) return 'Invalid placement position';
  if (structures.length >= BUILDING_RULES.MAX_STRUCTURES) return 'Structure limit reached';
  if (candidate.snapped || candidate.parentId || candidate.socketId) {
    const parent = structures.find(structure => structure.id === candidate.parentId);
    const socket = parent && getSockets(parent).find(point => point.id === candidate.socketId && point.accepts.includes(candidate.pieceType));
    if (!socket || distance(socket.position, candidate.position) > 0.02 || Math.abs(normalizeRotation(socket.rotation - candidate.rotation)) > 0.02) return 'Attachment is no longer available';
    if (structures.some(structure => structure.socketId === socket.id)) return 'Socket is occupied';
  } else if (candidate.pieceType !== 'foundation') return 'Aim at a compatible building socket';

  if (playerPos && placementIntersectsPlayer(candidate, playerPos)) return 'Step clear of the placement preview';

  for (const structure of structures) {
    if (candidate.pieceType === 'door' && structure.id === candidate.parentId && structure.pieceType === 'doorway') continue;
    if (candidate.pieceType === 'doorway' && structure.pieceType === 'door' && structure.parentId === candidate.parentId) continue;
    // Walls meet at their outside corners; those small intersections are intentional joints.
    const candidateWall = candidate.pieceType === 'wall' || candidate.pieceType === 'doorway';
    const existingWall = structure.pieceType === 'wall' || structure.pieceType === 'doorway';
    if (candidateWall && existingWall && near(candidate.position.y, structure.position.y)) {
      const alignment = Math.abs(Math.cos(candidate.rotation - structure.rotation));
      const centers = Math.hypot(candidate.position.x - structure.position.x, candidate.position.z - structure.position.z);
      if (alignment < 0.01 && centers > BUILD.SIZE * 0.65) continue;
    }
    if (overlaps(footprint(candidate), footprint(structure))) return 'Another structure occupies this space';
  }
  return null;
}

export function findBuildCandidate(piece: PieceType, target: Vec3, rotation: number, structures: Structure[], heightAt: (x: number, z: number) => number, count: (id: ItemId) => number, playerPos: Vec3): BuildCandidate {
  const available = structures.flatMap(getSockets).filter(socket => socket.accepts.includes(piece));
  const candidates = available.map(socket => ({ socket, distance: distance(socket.position, target) })).filter(entry => entry.distance <= BUILD.SNAP_DISTANCE).sort((a, b) => a.distance - b.distance);
  // Keep the closest occupied socket visible and red so the preview never jumps behind a wall.
  const selected = candidates[0]?.socket;
  const candidate: BuildCandidate = selected
    ? { pieceType: piece, position: { ...selected.position }, rotation: selected.rotation, valid: true, reason: '', snapped: true, parentId: selected.parentId, socketId: selected.id }
    : { pieceType: piece, position: { ...target }, rotation: normalizeRotation(rotation), valid: true, reason: '', snapped: false };

  const fail = (reason: string): BuildCandidate => ({ ...candidate, valid: false, reason });
  if (!selected && piece !== 'foundation') return fail(piece === 'door' ? 'Aim at an empty doorway' : piece === 'floor' || piece === 'roof' ? 'Aim above a wall or doorway' : 'Aim at the edge of a foundation or floor');

  if (piece === 'foundation') {
    const c = Math.cos(candidate.rotation), s = Math.sin(candidate.rotation), half = BUILD.SIZE / 2;
    const ground = [[0, 0], [-half, -half], [half, -half], [half, half], [-half, half]].map(([x, z]) => heightAt(candidate.position.x + x * c + z * s, candidate.position.z - x * s + z * c));
    const low = Math.min(...ground), high = Math.max(...ground);
    if (!selected) candidate.position.y = high - BUILDING_RULES.FOUNDATION_EMBED;
    if (ground.some(value => !Number.isFinite(value))) return fail('Outside the buildable world');
    if (low < BUILDING_RULES.MIN_GROUND_HEIGHT) return fail('Cannot build below the shoreline');
    if (high - low > BUILDING_RULES.MAX_TERRAIN_VARIATION) return fail('Terrain is too steep');
    if (selected && (high > candidate.position.y + BUILD.FOUNDATION_HEIGHT - 0.05 || low < candidate.position.y - 0.5)) return fail('Foundation needs ground support');
  }

  if (Math.hypot(candidate.position.x - playerPos.x, candidate.position.z - playerPos.z) > BUILD.MAX_DISTANCE || Math.abs(candidate.position.y - playerPos.y) > BUILD.MAX_DISTANCE) return fail('Move closer to build');
  const problem = validateStructurePlacement(candidate, structures, playerPos);
  if (problem) return fail(problem);
  const missing = Object.entries(PIECES[piece].cost).filter(([id, amount]) => count(id as ItemId) < (amount ?? 0));
  if (missing.length) return fail('Not enough resources');
  candidate.reason = selected ? 'Snapped · ready to build' : 'Ready to build';
  return candidate;
}
