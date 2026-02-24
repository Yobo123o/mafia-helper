import { describe, expect, it } from "vitest";
import { evaluateWinCondition, resolveNight } from "./engine";
import { ROLE_TYPES } from "./roles";
import { getInitialRoleStates } from "./rules";
import type { ResolveNightInput } from "./engine";
import type { RoleType } from "./types";

function makeAssignments(): Record<RoleType, string[]> {
  const assignments = {} as Record<RoleType, string[]>;
  for (const role of ROLE_TYPES) assignments[role] = [];
  return assignments;
}

function makeNightActions(): ResolveNightInput["nightActions"] {
  const actions = {} as ResolveNightInput["nightActions"];
  for (const role of ROLE_TYPES) actions[role] = { targetIds: [] };
  return actions;
}

function makeInput(overrides?: Partial<ResolveNightInput>): ResolveNightInput {
  return {
    nightNumber: 1,
    players: [
      { id: "p1", name: "P1" },
      { id: "p2", name: "P2" },
      { id: "p3", name: "P3" },
      { id: "p4", name: "P4" },
      { id: "p5", name: "P5" },
    ],
    deadPlayerIds: [],
    roleAssignments: makeAssignments(),
    nightActions: makeNightActions(),
    roleStates: getInitialRoleStates(),
    loverPairs: [],
    ...overrides,
  };
}

describe("resolveNight targeted interactions", () => {
  it("applies Bus Driver redirect before Detective investigation resolves", () => {
    const roleAssignments = makeAssignments();
    roleAssignments.Detective = ["p1"];
    roleAssignments.BusDriver = ["p2"];
    roleAssignments.Miller = ["p4"];

    const nightActions = makeNightActions();
    nightActions.Detective = { targetIds: ["p3"] };
    nightActions.BusDriver = { targetIds: ["p3", "p4"] };

    const output = resolveNight(makeInput({ roleAssignments, nightActions }));

    expect(output.result.busSwaps).toEqual([{ a: "p3", b: "p4" }]);
    expect(output.result.investigations).toEqual([
      { actorRole: "Detective", targetId: "p4", result: "Guilty" },
    ]);
  });

  it("lets Mafia kill through when Bartender blocks Doctor", () => {
    const roleAssignments = makeAssignments();
    roleAssignments.Bartender = ["p1"];
    roleAssignments.Doctor = ["p2"];
    roleAssignments.Mafia = ["p4"];

    const nightActions = makeNightActions();
    nightActions.Bartender = { targetIds: ["p2"] };
    nightActions.Doctor = { targetIds: ["p3"] };
    nightActions.Mafia = { targetIds: ["p3"] };

    const output = resolveNight(makeInput({ roleAssignments, nightActions, nightNumber: 2 }));

    expect(output.result.blocked).toContain("Doctor");
    expect(output.result.saves).not.toContain("p3");
    expect(output.result.deaths).toContain("p3");
    expect(output.nextRoleStates.Doctor.lastSavedPlayerId).toBeUndefined();
  });

  it("records Lawyer day immunity and updates last defended player", () => {
    const roleAssignments = makeAssignments();
    roleAssignments.Lawyer = ["p1"];

    const nightActions = makeNightActions();
    nightActions.Lawyer = { targetIds: ["p3"] };

    const output = resolveNight(makeInput({ roleAssignments, nightActions, nightNumber: 2 }));

    expect(output.result.dayImmunities).toEqual(["p3"]);
    expect(output.nextRoleStates.Lawyer.lastDefendedPlayerId).toBe("p3");
  });

  it("suppresses Detective investigation when Made Man recruits Detective that night", () => {
    const roleAssignments = makeAssignments();
    roleAssignments.MadeMan = ["p1"];
    roleAssignments.Detective = ["p2"];

    const nightActions = makeNightActions();
    nightActions.MadeMan = { targetIds: ["p2"] };
    nightActions.Detective = { targetIds: ["p3"] };

    const output = resolveNight(makeInput({ roleAssignments, nightActions, nightNumber: 2 }));

    expect(output.result.investigations).toEqual([]);
    expect(output.result.recruits).toEqual(["p2"]);
    expect(output.result.recruitDetails).toEqual([{ playerId: "p2", fromRole: "Detective" }]);
    expect(output.nextRoleAssignments.Detective).toEqual([]);
    expect(output.nextRoleAssignments.Mafia).toContain("p2");
    expect(output.result.notes).toContain("Detective was converted before investigation resolved.");
  });

  it("grandma retaliation kills non-Godfather mafia first when mafia visits", () => {
    const roleAssignments = makeAssignments();
    roleAssignments.Grandma = ["p1"];
    roleAssignments.Mafia = ["p2"];
    roleAssignments.MadeMan = ["p3"];
    roleAssignments.Godfather = ["p4"];

    const nightActions = makeNightActions();
    nightActions.Mafia = { targetIds: ["p1"] };

    const output = resolveNight(makeInput({ roleAssignments, nightActions, nightNumber: 2 }));

    expect(output.result.deaths).toContain("p3");
    expect(output.result.deaths).not.toContain("p4");
    expect(output.result.notes).toContain("Grandma retaliated against the Mafia visit.");
  });

  it("propagates lover chain deaths from a kill", () => {
    const roleAssignments = makeAssignments();
    roleAssignments.Mafia = ["p1"];

    const nightActions = makeNightActions();
    nightActions.Mafia = { targetIds: ["p2"] };

    const output = resolveNight(
      makeInput({
        roleAssignments,
        nightActions,
        nightNumber: 2,
        loverPairs: [["p2", "p3"]],
      })
    );

    expect(output.result.deaths.sort()).toEqual(["p2", "p3"]);
    expect(output.result.notes).toContain("Lover chain death occurred.");
  });

  it("sets vigilante pending lockout after killing a town player", () => {
    const roleAssignments = makeAssignments();
    roleAssignments.Vigilante = ["p1"];
    roleAssignments.Doctor = ["p4"];

    const nightActions = makeNightActions();
    nightActions.Vigilante = { targetIds: ["p2"] };

    const output = resolveNight(makeInput({ roleAssignments, nightActions, nightNumber: 2 }));

    expect(output.result.deaths).toContain("p2");
    expect(output.nextRoleStates.Vigilante.usedShot).toBe(true);
    expect(output.nextRoleStates.Vigilante.pendingLockout).toBe(true);
    expect(output.result.notes).toContain("Vigilante killed a Town player and will be locked out next night.");
  });
});

describe("evaluateWinCondition", () => {
  const players = [
    { id: "p1" },
    { id: "p2" },
    { id: "p3" },
    { id: "p4" },
  ];

  it("returns serial killer win when serial killer is last alive", () => {
    const assignments = makeAssignments();
    assignments.SerialKiller = ["p1"];
    assignments.Mafia = ["p2"];
    assignments.RivalMafia = ["p3"];
    assignments.Detective = ["p4"];

    const winner = evaluateWinCondition(players, ["p2", "p3", "p4"], assignments);
    expect(winner).toBe("Serial Killer wins");
  });

  it("returns town win when hostile factions and serial killer are eliminated", () => {
    const assignments = makeAssignments();
    assignments.Detective = ["p1"];
    assignments.Doctor = ["p2"];
    assignments.Mafia = ["p3"];
    assignments.SerialKiller = ["p4"];

    const winner = evaluateWinCondition(players, ["p3", "p4"], assignments);
    expect(winner).toBe("Town wins");
  });
});
