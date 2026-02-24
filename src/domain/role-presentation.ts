import type { IconType } from "react-icons";
import {
  GiAssassinPocket,
  GiBus,
  GiCigar,
  GiCupidonArrow,
  GiFedora,
  GiHospitalCross,
  GiKingJuMask,
  GiMagicHat,
  GiMailbox,
  GiPerson,
  GiPistolGun,
  GiPoliceOfficerHead,
  GiPotionOfMadness,
  GiScales,
  GiShield,
  GiSkullCrossedBones,
  GiSpy,
  GiTie,
} from "react-icons/gi";
import type { Alignment, RoleType } from "./types";

export const UNIQUE_ROLES = new Set<RoleType>([
  "Detective",
  "Doctor",
  "Miller",
  "Cupid",
  "BusDriver",
  "UndercoverCop",
  "Grandma",
  "Magician",
  "Postman",
  "Vigilante",
  "Godfather",
  "Lawyer",
  "MadeMan",
  "Bartender",
  "SerialKiller",
]);

export const ALIGNMENTS: Alignment[] = ["Town", "Mafia", "RivalMafia", "Neutral"];

export const ALIGNMENT_LABELS: Record<Alignment, string> = {
  Town: "Town",
  Mafia: "Mafia",
  RivalMafia: "Rival Mafia",
  Neutral: "Neutral",
};

export const ALIGNMENT_STYLES: Record<
  Alignment,
  { badge: string; border: string; text: string; glow: string }
> = {
  Town: {
    badge: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
    border: "border-emerald-500/30",
    text: "text-emerald-300",
    glow: "bg-emerald-500/30",
  },
  Mafia: {
    badge: "bg-red-500/15 text-red-300 border-red-500/40",
    border: "border-red-500/30",
    text: "text-red-300",
    glow: "bg-red-500/30",
  },
  RivalMafia: {
    badge: "bg-amber-500/15 text-amber-300 border-amber-500/40",
    border: "border-amber-500/30",
    text: "text-amber-300",
    glow: "bg-amber-500/30",
  },
  Neutral: {
    badge: "bg-cyan-500/15 text-cyan-300 border-cyan-500/40",
    border: "border-cyan-500/30",
    text: "text-cyan-300",
    glow: "bg-cyan-500/30",
  },
};

export const ROLE_ICONS: Record<RoleType, IconType> = {
  Civilian: GiPerson,
  Detective: GiPoliceOfficerHead,
  Doctor: GiHospitalCross,
  Miller: GiTie,
  Cupid: GiCupidonArrow,
  BusDriver: GiBus,
  UndercoverCop: GiSpy,
  Grandma: GiShield,
  Magician: GiMagicHat,
  Postman: GiMailbox,
  Vigilante: GiPistolGun,
  Mafia: GiFedora,
  Godfather: GiCigar,
  Lawyer: GiScales,
  MadeMan: GiAssassinPocket,
  Bartender: GiPotionOfMadness,
  SerialKiller: GiSkullCrossedBones,
  RivalMafia: GiKingJuMask,
};

export function roleLabel(role: RoleType): string {
  return role.replace(/([a-z])([A-Z])/g, "$1 $2");
}
