/** Damage categories stay independent from presentation strings and actor IDs. */
export const DAMAGE_TYPES = ['melee', 'projectile', 'environmental', 'cold', 'toxic'] as const;
export type DamageType = typeof DAMAGE_TYPES[number];

export interface DamagePacket {
  amount: number;
  type: DamageType;
  sourceId?: string;
}

export interface DamageResult {
  ok: boolean;
  type: DamageType;
  requested: number;
  applied: number;
  absorbed: number;
  healthBefore: number;
  healthAfter: number;
  killed: boolean;
  sourceId?: string;
}

/** Actors can share the same damage path without depending on player state or rendering. */
export interface Damageable {
  takeDamage(packet: DamagePacket, mitigation?: number): DamageResult;
}

/**
 * Resolves one hit. Mitigation is a fraction in [0, .85], not a flat amount;
 * the cap keeps future equipment from making a target completely invulnerable.
 */
export function resolveDamage(
  health: number,
  maxHealth: number,
  packet: DamagePacket,
  mitigation = 0,
): DamageResult {
  const safeMaxHealth = Number.isFinite(maxHealth) && maxHealth > 0 ? maxHealth : 0;
  const before = Number.isFinite(health) ? Math.max(0, Math.min(safeMaxHealth, health)) : 0;
  const valid = safeMaxHealth > 0
    && Number.isFinite(packet.amount) && packet.amount > 0
    && DAMAGE_TYPES.includes(packet.type);
  const requested = valid ? packet.amount : 0;
  const reduction = Number.isFinite(mitigation) ? Math.max(0, Math.min(.85, mitigation)) : 0;
  const applied = Math.min(before, requested * (1 - reduction));
  const after = Math.max(0, before - applied);
  const sourceId = typeof packet.sourceId === 'string' ? packet.sourceId.slice(0, 96) : undefined;
  return {
    ok: valid,
    type: packet.type,
    requested,
    applied,
    absorbed: requested * reduction,
    healthBefore: before,
    healthAfter: after,
    killed: before > 0 && after === 0,
    ...(sourceId ? { sourceId } : {}),
  };
}

/** Compatibility adapter for existing fall/environment/death call sites. */
export function damageTypeForCause(cause: string): DamageType {
  const normalized = cause.toLowerCase();
  if (/cold|hypotherm/.test(normalized)) return 'cold';
  if (/toxic|contaminat|radiat/.test(normalized)) return 'toxic';
  if (/projectile|arrow|bullet|firearm/.test(normalized)) return 'projectile';
  if (/melee|bite|claw|strike/.test(normalized)) return 'melee';
  return 'environmental';
}
