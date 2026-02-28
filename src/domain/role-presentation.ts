import type { ComponentType } from "react";
import {
  GiAssassinPocket,
  GiBandit,
  GiBus,
  GiCigar,
  GiCupidonArrow,
  GiFedora,
  GiGlassShot,
  GiHospitalCross,
  GiJesterHat,
  GiKingJuMask,
  GiMagicHat,
  GiMustache,
  GiPerson,
  GiPoliceOfficerHead,
  GiRevolver,
  GiScales,
  GiSpy,
} from "react-icons/gi";
import { MdElderlyWoman } from "react-icons/md";
import type { Alignment, RoleType } from "./types";

export type RoleIconComponent = ComponentType<{ className?: string }>;

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
  "RivalGodfather",
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

export const ROLE_ICONS: Record<RoleType, RoleIconComponent> = {
  Civilian: GiPerson,
  Detective: GiPoliceOfficerHead,
  Doctor: GiHospitalCross,
  Miller: GiMustache,
  Cupid: GiCupidonArrow,
  BusDriver: GiBus,
  UndercoverCop: GiSpy,
  Grandma: MdElderlyWoman,
  Magician: GiMagicHat,
  Postman: GiJesterHat,
  Vigilante: GiRevolver,
  Mafia: GiFedora,
  Godfather: GiCigar,
  RivalGodfather: GiCigar,
  Lawyer: GiScales,
  MadeMan: GiAssassinPocket,
  Bartender: GiGlassShot,
  SerialKiller: GiKingJuMask,
  RivalMafia: GiBandit,
};

export function roleLabel(role: RoleType): string {
  if (role === "Miller") return "Outcast";
  if (role === "Postman") return "Jester";
  return role.replace(/([a-z])([A-Z])/g, "$1 $2");
}
