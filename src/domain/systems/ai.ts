import { isAlive, type Entity } from "../components";
import { directionXZ, distanceXZ, lerpAngle, yawFromDirection, clamp } from "../math";
import type { World } from "../world";
import { BOSS_MINION, raiseCarapace, resetBoss, updateBossPhase } from "../boss";
import { createEnemy } from "../factories";
import { startAttack } from "./combat";
import { isStunned } from "../status";

/**
 * Máquina de estados simples por inimigo:
 * idle -> chase (jogador entrou no aggro) -> attack (em alcance) -> return (longe de casa).
 */
export function aiSystem(world: World, dt: number): void {
  const player = world.player;
  const playerAlive = player !== undefined && isAlive(player);

  for (const e of world.alive()) {
    const ai = e.ai;
    if (!ai) continue;
    const pos = e.transform.position;
    e.movement.intent = { x: 0, z: 0 };
    e.movement.faceYaw = undefined;
    e.combat.wantsAttack = false;
    if (isStunned(e)) continue; // atordoado: não pensa, não anda, não ataca

    const distHome = distanceXZ(pos, ai.home);
    const distPlayer = playerAlive ? distanceXZ(pos, player.transform.position) : Infinity;

    if (e.boss) {
      bossBehavior(world, e, dt, playerAlive ? player : undefined, distPlayer, distHome);
      continue;
    }

    switch (ai.state) {
      case "idle":
        if (playerAlive && distPlayer <= ai.aggroRange) ai.state = "chase";
        break;

      case "chase":
        if (!playerAlive || distHome > ai.leashRange) {
          ai.state = "return";
        } else if (distPlayer <= e.combat.range) {
          ai.state = "attack";
        } else {
          e.movement.intent = directionXZ(pos, player.transform.position);
        }
        break;

      case "attack":
        if (!playerAlive || distHome > ai.leashRange) {
          ai.state = "return";
        } else if (distPlayer > e.combat.range * 1.15) {
          ai.state = "chase";
        } else {
          // Vira para o jogador e tenta atacar; o sistema de combate decide pelo cooldown.
          const dir = directionXZ(pos, player.transform.position);
          e.transform.yaw = lerpAngle(e.transform.yaw, yawFromDirection(dir), clamp(10 * dt, 0, 1));
          // Atirador acuado recua entre um tiro e outro (nunca no meio do aviso).
          const keep = ai.keepDistance;
          if (keep && distPlayer < keep && e.combat.windupLeft <= 0 && e.combat.cooldownLeft > 0) {
            e.movement.intent = { x: -dir.x, z: -dir.z };
            e.movement.faceYaw = yawFromDirection(dir);
          } else {
            e.movement.faceYaw = undefined;
            e.combat.wantsAttack = true;
          }
        }
        break;

      case "return":
        if (distHome < 1) {
          ai.state = "idle";
          // Volta para casa recuperado: evita "kiting" infinito.
          e.health.current = e.health.max;
        } else {
          e.movement.intent = directionXZ(pos, ai.home);
        }
        break;
    }
  }
}

/**
 * Chefe: alterna padrões de golpe telegrafados conforme a distância e os cooldowns,
 * muda de fase com a vida e invoca lacaios na fase final.
 */
function bossBehavior(world: World, e: Entity, dt: number, player: Entity | undefined, distPlayer: number, distHome: number): void {
  const ai = e.ai!;
  const boss = e.boss!;
  const pos = e.transform.position;
  for (const id of Object.keys(boss.cooldowns)) boss.cooldowns[id] = Math.max(0, (boss.cooldowns[id] ?? 0) - dt);

  if (ai.state === "idle") {
    if (player && distPlayer <= ai.aggroRange) {
      ai.state = "chase";
      boss.engaged = true;
      world.emit({ type: "bossEngage", entity: e.id });
      if (raiseCarapace(e)) world.emit({ type: "carapaceUp", entity: e.id, layers: boss.carapace!.layers });
    }
    return;
  }

  if (ai.state === "return") {
    if (distHome < 1.5) {
      ai.state = "idle";
      e.health.current = e.health.max;
      resetBoss(e);
    } else {
      e.movement.intent = directionXZ(pos, ai.home);
    }
    return;
  }

  // Em combate (chase/attack).
  if (!player || distHome > ai.leashRange) {
    ai.state = "return";
    e.combat.windupLeft = 0;
    e.combat.pending = undefined;
    return;
  }

  const newPhase = updateBossPhase(e);
  if (newPhase !== null) {
    world.emit({ type: "bossPhase", entity: e.id, phase: newPhase });
    // A carapaça se refaz a cada fase.
    if (raiseCarapace(e)) world.emit({ type: "carapaceUp", entity: e.id, layers: boss.carapace!.layers });
  }
  // Carapaça partida: atordoado, não age nem anda.
  const shell = boss.carapace;
  if (shell && shell.stunLeft > 0) {
    shell.stunLeft = Math.max(0, shell.stunLeft - dt);
    ai.state = "attack";
    return;
  }
  if (boss.phase >= 3 && !boss.summoned) {
    boss.summoned = true;
    const kind = (BOSS_MINION[e.archetype] ?? "goblin") as Parameters<typeof createEnemy>[1];
    const count = kind === "spider" ? 3 : 2;
    const minions = Array.from({ length: count }, (_, i) => {
      const angle = e.transform.yaw + (i - (count - 1) / 2) * 1.3;
      const spawnAt = { x: pos.x - Math.sin(angle) * 2.5, y: pos.y, z: pos.z - Math.cos(angle) * 2.5 };
      const minion = world.spawn((id) => createEnemy(id, kind, spawnAt));
      minion.ai!.respawnSeconds = Infinity; // lacaios não renascem
      minion.ai!.state = "chase";
      minion.ai!.leashRange = 60;
      return minion.id;
    });
    world.emit({ type: "bossSummon", entity: e.id, minions });
  }

  // Preparando ou executando um golpe: fica parado encarando o alvo.
  if (e.combat.windupLeft > 0 || e.abilities?.dash) {
    if (e.combat.windupLeft > 0) {
      const dir = directionXZ(pos, player.transform.position);
      e.transform.yaw = lerpAngle(e.transform.yaw, yawFromDirection(dir), clamp(6 * dt, 0, 1));
    }
    return;
  }

  const ready = boss.patterns.filter((p) => p.minPhase <= boss.phase && (boss.cooldowns[p.id] ?? 0) <= 0);
  const choose = () => {
    // Longe: investida. Perto: golpe básico; o pisão entra quando o golpe está em recarga
    // ou quando o jogador fica a meia distância (fora do melee, dentro do raio).
    const charge = ready.find((p) => p.kind === "charge");
    if (charge && distPlayer > 5 && distPlayer <= charge.range) return charge;
    const melee = ready.find((p) => p.kind === "melee");
    if (melee && distPlayer <= melee.range) return melee;
    const slam = ready.find((p) => p.kind === "slam");
    if (slam && distPlayer <= slam.range * 0.8) return slam;
    const aoe = ready.find((p) => p.kind === "aoe" || p.kind === "lob");
    if (aoe && distPlayer <= (aoe.castRange ?? aoe.range)) return aoe;
    // Leque: de média distância, ou de perto quando o golpe está em recarga.
    const fan = ready.find((p) => p.kind === "fan");
    if (fan && distPlayer <= fan.range * 0.85) return fan;
    return undefined;
  };
  const pattern = choose();
  if (pattern) {
    ai.state = "attack";
    boss.cooldowns[pattern.id] = pattern.cooldown;
    startAttack(world, e, pattern, pattern.windup * boss.windupScale);
  } else {
    ai.state = "chase";
    if (distPlayer > 2.4) e.movement.intent = directionXZ(pos, player.transform.position);
  }
}
