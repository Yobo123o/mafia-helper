"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { TimelineEntry } from "@/lib/session";

export function EventTimelinePanel({ timeline }: { timeline: TimelineEntry[] }) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | TimelineEntry["kind"]>("all");
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const items = useMemo(() => {
    const filtered = filter === "all" ? timeline : timeline.filter((entry) => entry.kind === filter);
    return [...filtered].slice(-12).reverse();
  }, [filter, timeline]);

  if (timeline.length === 0) return null;

  function toggleExpanded(id: string) {
    setExpandedIds((current) => ({ ...current, [id]: !current[id] }));
  }

  return (
    <Card className="border-border/60 bg-card/70 backdrop-blur">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>Session Log</CardTitle>
            <CardDescription>Audit trail for night/day resolutions, skips, and rollbacks.</CardDescription>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={() => setOpen((value) => !value)}>
            {open ? "Hide Log" : `Show Log (${Math.min(timeline.length, 12)})`}
          </Button>
        </div>
      </CardHeader>
      {open && (
      <CardContent>
        <div className="mb-3 flex flex-wrap gap-2">
          {(["all", "night", "day", "system"] as const).map((kind) => (
            <Button
              key={kind}
              type="button"
              size="sm"
              variant={filter === kind ? "secondary" : "outline"}
              onClick={() => setFilter(kind)}
              className="h-8"
            >
              {kind === "all" ? "All" : kind[0].toUpperCase() + kind.slice(1)}
            </Button>
          ))}
        </div>
        <div className="space-y-2">
          {items.map((entry) => (
            <div key={entry.id} className="rounded-lg border border-border/60 bg-background/40 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="text-[10px] uppercase">
                  {entry.kind}
                </Badge>
                {typeof entry.nightNumber === "number" && (
                  <Badge variant="secondary" className="text-[10px]">
                    N{entry.nightNumber}
                  </Badge>
                )}
                {typeof entry.dayNumber === "number" && (
                  <Badge variant="secondary" className="text-[10px]">
                    D{entry.dayNumber}
                  </Badge>
                )}
                <p className="text-sm font-semibold">{entry.title}</p>
              </div>
              {entry.detail && (
                <div className="mt-1">
                  <button
                    type="button"
                    className="text-left text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => toggleExpanded(entry.id)}
                  >
                    {expandedIds[entry.id]
                      ? entry.detail
                      : `${entry.detail.slice(0, 120)}${entry.detail.length > 120 ? "..." : ""}`}
                  </button>
                </div>
              )}
            </div>
          ))}
          {items.length === 0 && <p className="text-sm text-muted-foreground">No events for this filter yet.</p>}
        </div>
      </CardContent>
      )}
    </Card>
  );
}
