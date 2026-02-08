import type { RoleStateMap, RoleType } from "./types";
import { ROLE_DEFINITIONS, WAKE_ORDER } from "./roles";

export type WakeOrderOptions = {
  nightNumber: number;
  rolesAlive?: Partial<Record<RoleType, boolean>>;
};

export type ActionValidationContext = {
  nightNumber: number;
  roleStates: RoleStateMap;
};

export type ActionValidationResult = {
  valid: boolean;
  reason?: string;
};

export function getInitialRoleStates(): RoleStateMap {
  return {
    Civilian: {},
    Detective: {},
    Doctor: {},
    Miller: {},
    Cupid: { used: false },
    BusDriver: {},
    UndercoverCop: {},
    Grandma: {},
    Magician: { usedKill: false, usedSave: false },
    Postman: { usedDelivery: false },
    Vigilante: { usedShot: false, lockedOut: false, pendingLockout: false },
    Mafia: {},
    Godfather: {},
    Lawyer: {},
    MadeMan: { usedRecruit: false },
    Bartender: {},
    SerialKiller: {},
    RivalMafia: {},
  };
}

export function buildWakeOrder(
  rolesInPlay: RoleType[],
  options: WakeOrderOptions
): RoleType[] {
  const { nightNumber, rolesAlive } = options;
  const isAlive = (role: RoleType) => rolesAlive?.[role] !== false;

  const wakeOrder: RoleType[] = [];

  if (rolesInPlay.includes("Cupid") && nightNumber === 1 && isAlive("Cupid")) {
    wakeOrder.push("Cupid");
  }

  const night1OnlyWakeRoles = new Set<RoleType>(["Postman", "Grandma"]);

  for (const role of WAKE_ORDER) {
    if (!rolesInPlay.includes(role)) continue;
    if (!isAlive(role)) continue;
    if (night1OnlyWakeRoles.has(role) && nightNumber !== 1) continue;
    wakeOrder.push(role);
  }

  return wakeOrder;
}

export function validateAction(
  role: RoleType,
  targetIds: string[],
  context: ActionValidationContext,
  metadata?: { choice?: "kill" | "save" | "none" }
): ActionValidationResult {
  const definition = ROLE_DEFINITIONS[role];
  const action = definition.action;

  if (!action) {
    return { valid: targetIds.length === 0 };
  }

  if (targetIds.length !== action.targetCount) {
    return { valid: false, reason: "Invalid target count." };
  }

  const states = context.roleStates;

  if (role === "Vigilante") {
    if (context.nightNumber === 1) {
      return { valid: false, reason: "Vigilante cannot shoot on Night 1." };
    }
    if (states.Vigilante.lockedOut) {
      return { valid: false, reason: "Vigilante is locked out after killing Town." };
    }
    if (states.Vigilante.usedShot) {
      return { valid: false, reason: "Vigilante already used their shot." };
    }
  }

  if (role === "Doctor") {
    if (states.Doctor.lastSavedPlayerId && targetIds[0] === states.Doctor.lastSavedPlayerId) {
      return { valid: false, reason: "Doctor cannot save the same player twice in a row." };
    }
  }

  if (role === "Lawyer") {
    if (states.Lawyer.lastDefendedPlayerId && targetIds[0] === states.Lawyer.lastDefendedPlayerId) {
      return { valid: false, reason: "Lawyer cannot defend the same player twice in a row." };
    }
  }

  if (role === "Magician") {
    const choice = metadata?.choice;
    if (!choice) {
      return { valid: false, reason: "Magician must choose Vanishing Act, Escape Trick, or No Action." };
    }
    if (choice === "none") {
      return { valid: true };
    }
    if (choice === "kill" && states.Magician.usedKill) {
      return { valid: false, reason: "Magician already used their kill." };
    }
    if (choice === "save" && states.Magician.usedSave) {
      return { valid: false, reason: "Magician already used their save." };
    }
  }

  if (role === "Cupid") {
    if (context.nightNumber !== 1) {
      return { valid: false, reason: "Cupid only acts on Night 1." };
    }
    if (states.Cupid.used) {
      return { valid: false, reason: "Cupid has already acted." };
    }
  }

  if (role === "MadeMan") {
    if (states.MadeMan.usedRecruit) {
      return { valid: false, reason: "Made Man already used recruit." };
    }
  }

  return { valid: true };
}
