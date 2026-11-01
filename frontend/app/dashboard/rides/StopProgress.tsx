"use client";

// Driver-only inline waypoint tracker (rendered inside a ride card, not a
// dialog). Extracted from the old monolith so the card component stays about
// the ride summary.

import type { RideInfo } from "./types";
import type { RidesController } from "./useRides";

export function StopProgress({
  ride,
  rides,
}: {
  ride: RideInfo;
  rides: RidesController;
}) {
  if (!ride.stop_details || ride.stop_details.length === 0) return null;

  return (
    <div
      data-testid="ride-stop-progress"
      style={{
        margin: "14px 0",
        padding: "12px 16px",
        background: "rgba(0,0,0,0.25)",
        borderRadius: "var(--radius-md)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <div style={{ fontSize: "0.85rem", fontWeight: 700, marginBottom: 8, color: "#38bdf8" }}>
        🚏 Route Waypoints &amp; Stop Tracking
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {ride.stop_details.map((stop) => (
          <div
            key={stop.id}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontSize: "0.82rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background:
                    stop.status === "departed"
                      ? "#10b981"
                      : stop.status === "reached"
                        ? "#f59e0b"
                        : "#64748b",
                }}
              />
              <span style={{ fontWeight: 600 }}>
                {stop.stop_order}. {rides.getHotspotName(stop.stop_name)}
              </span>
              <span className="badge" style={{ fontSize: "0.7rem", padding: "2px 6px" }}>
                {stop.status}
              </span>
            </div>
            {ride.status === "active" && (
              <div style={{ display: "flex", gap: 6 }}>
                {stop.status === "pending" && (
                  <button
                    className="btn btn-sm"
                    data-testid="ride-stop-reached"
                    style={{
                      padding: "2px 8px",
                      fontSize: "0.75rem",
                      background: "var(--warning)",
                      color: "#000",
                    }}
                    onClick={() => rides.updateStopStatus(ride.id, stop.id, "reached")}
                  >
                    Mark Reached
                  </button>
                )}
                {stop.status === "reached" && (
                  <button
                    className="btn btn-sm"
                    data-testid="ride-stop-departed"
                    style={{
                      padding: "2px 8px",
                      fontSize: "0.75rem",
                      background: "var(--success)",
                      color: "#000",
                    }}
                    onClick={() => rides.updateStopStatus(ride.id, stop.id, "departed")}
                  >
                    Mark Departed
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
