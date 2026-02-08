import { expect, test } from "@playwright/test";

const SESSION_STORAGE_KEY = "mafia-helper-session";
const NO_ACTION = "__no_action__";

function makeRoleCounts() {
  return {
    Civilian: 0,
    Detective: 1,
    Doctor: 0,
    Miller: 0,
    Cupid: 0,
    BusDriver: 0,
    UndercoverCop: 0,
    Grandma: 0,
    Magician: 0,
    Postman: 0,
    Vigilante: 0,
    Mafia: 1,
    Godfather: 0,
    Lawyer: 0,
    MadeMan: 0,
    Bartender: 0,
    SerialKiller: 0,
    RivalMafia: 0,
  };
}

function makeRoleAssignments() {
  return {
    Civilian: [],
    Detective: ["p1"],
    Doctor: [],
    Miller: [],
    Cupid: [],
    BusDriver: [],
    UndercoverCop: [],
    Grandma: [],
    Magician: [],
    Postman: [],
    Vigilante: [],
    Mafia: ["p3"],
    Godfather: [],
    Lawyer: [],
    MadeMan: [],
    Bartender: [],
    SerialKiller: [],
    RivalMafia: [],
  };
}

function makeNightActions() {
  return {
    Civilian: { targetIds: [] },
    Detective: { targetIds: ["p2"] },
    Doctor: { targetIds: [] },
    Miller: { targetIds: [] },
    Cupid: { targetIds: [] },
    BusDriver: { targetIds: [] },
    UndercoverCop: { targetIds: [] },
    Grandma: { targetIds: [] },
    Magician: { targetIds: [] },
    Postman: { targetIds: [] },
    Vigilante: { targetIds: [] },
    Mafia: { targetIds: [NO_ACTION] },
    Godfather: { targetIds: [] },
    Lawyer: { targetIds: [] },
    MadeMan: { targetIds: [] },
    Bartender: { targetIds: [] },
    SerialKiller: { targetIds: [] },
    RivalMafia: { targetIds: [] },
  };
}

function makeRoleStates() {
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

test("moderator smoke flow: night -> summary -> day -> next night", async ({ page }) => {
  await page.addInitScript(({ key, session }) => {
    window.localStorage.setItem(key, JSON.stringify(session));
  }, {
    key: SESSION_STORAGE_KEY,
    session: {
      players: [
        { id: "p1", name: "Test Player 1" },
        { id: "p2", name: "Test Player 2" },
        { id: "p3", name: "Test Player 3" },
      ],
      roleCounts: makeRoleCounts(),
      nightNumber: 1,
      dayNumber: 0,
      nightInProgress: true,
      dayInProgress: false,
      dayEliminationDone: false,
      wakeIndex: 1,
      sessionActive: true,
      roleAssignments: makeRoleAssignments(),
      nightActions: makeNightActions(),
      deadPlayerIds: [],
      roleStates: makeRoleStates(),
      loverPairs: [],
      convertedOrigins: {},
      previousNightSnapshot: null,
      lastNightResult: null,
      winCondition: null,
    },
  });

  await page.goto("/session");

  await expect(page.getByRole("heading", { name: "Night 1" })).toBeVisible();
  await expect(page.getByText("Choose a player to become Detective.")).toBeVisible();

  const endNight = page.getByRole("button", { name: "End Night 1" });
  await expect(endNight).toBeEnabled();
  await endNight.click();

  await expect(page.getByRole("heading", { name: "Night 1 Summary" })).toBeVisible();
  await page.getByRole("button", { name: "Proceed to Day 2" }).click();

  await expect(page.getByText("Day 2 - Town Vote")).toBeVisible();
  await page.getByRole("button", { name: "Skip Hang" }).click();
  await page.getByRole("button", { name: "Start Night 2" }).click();

  await expect(page.getByRole("heading", { name: "Night 2" })).toBeVisible();
});
