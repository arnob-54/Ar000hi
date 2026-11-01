"use client";

import Link from "next/link";

import { badgeClass, RIDE_STATUS_BADGE } from "@/lib/badges";
import { fmtDateTime } from "@/lib/format";
import { StopProgress } from "./StopProgress";
import type { RideInfo } from "./types";
import type { RidesController } from "./useRides";

export function RideCard({
  ride,
  mine,
  rides,
}: {
  ride: RideInfo;
  mine: boolean;
  rides: RidesController;
}) {
  const s = rides.split[ride.id];
  const isDriver = Boolean(rides.me && ride.driver_id === rides.me.id);
  const isParticipant = mine || isDriver;
  const chatOpen = isParticipant && (ride.status === "active" || ride.status === "scheduled");
  const seatIsActive =
    Boolean(isDriver) ||
    ride.my_seat_status === "requested" ||
    ride.my_seat_status === "accepted" ||
    Boolean(!isDriver && mine && ride.my_seat_status == null);
  const canCancel = Boolean(
    isParticipant && seatIsActive && (ride.status === "scheduled" || ride.status === "active")
  );

  return (
    <div
      data-testid="ride-card"
      data-ride-id={ride.id}
      className="glass-card"
      style={{
        padding: 20,
        border: ride.female_only ? "1px solid rgba(236, 72, 153, 0.4)" : undefined,
        background: ride.female_only
          ? "linear-gradient(135deg, rgba(236, 72, 153, 0.05), rgba(15, 23, 42, 0.8))"
          : undefined,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 12,
        }}
      >
        <div>
          {/* Route path with Stops */}
          <div
            style={{
              fontWeight: 700,
              fontSize: "1.05rem",
              color: "var(--text-primary)",
              display: "flex",
              alignItems: "center",
              gap: 6,
              flexWrap: "wrap",
            }}
          >
            <span>📍 {rides.getHotspotName(ride.source)}</span>
            {ride.stops &&
              ride.stops.length > 0 &&
              ride.stops.map((stop, idx) => (
                <span key={idx} style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
                  ➜ <span style={{ color: "#a78bfa" }}>{rides.getHotspotName(stop)}</span>
                </span>
              ))}
            <span>➜ 🏁 {rides.getHotspotName(ride.destination)}</span>
          </div>

          <div
            style={{
              fontSize: "0.82rem",
              color: "var(--text-secondary)",
              marginTop: 6,
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <span>
              👤 Driver: <strong>{ride.driver_name}</strong>
            </span>
            <span>🚘 {ride.total_seats} total seats</span>
            {ride.distance_km && <span>📏 est. {ride.distance_km} km</span>}
          </div>

          {ride.scheduled_at && (
            <div
              style={{
                fontSize: "0.82rem",
                color: "var(--primary)",
                marginTop: 6,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span>📅 Scheduled:</span>
              <strong>{fmtDateTime(ride.scheduled_at)}</strong>
            </div>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
          {ride.female_only && (
            <span
              className="badge"
              style={{
                background: "rgba(236, 72, 153, 0.2)",
                color: "#f472b6",
                border: "1px solid rgba(236, 72, 153, 0.4)",
              }}
            >
              🌸 Female-Only
            </span>
          )}
          <span className={`badge ${badgeClass(RIDE_STATUS_BADGE, ride.status, "badge-warning")}`}>
            {ride.status}
          </span>
          {ride.surge_multiplier > 1 && (
            <span className="badge badge-danger">⚡ Surge ×{ride.surge_multiplier}</span>
          )}
        </div>
      </div>

      {/* Multi-Stop Real-Time Status Progress (Driver View for active rides) */}
      {isDriver && <StopProgress ride={ride} rides={rides} />}

      <div style={{ fontSize: "0.95rem", color: "var(--text-secondary)", marginBottom: 14 }}>
        Base Fare: <strong style={{ color: "var(--text-primary)" }}>৳{ride.base_fare}</strong>
        {ride.surge_multiplier > 1 && (
          <span style={{ color: "var(--warning)", marginLeft: 8 }}>
            × {ride.surge_multiplier} = ৳{(ride.base_fare * ride.surge_multiplier).toFixed(2)}
          </span>
        )}
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {!mine &&
          ride.status === "scheduled" &&
          (ride.available_seats === 0 ? (
            <span className="badge badge-danger">Full</span>
          ) : (
            <button
              className="btn btn-sm btn-primary"
              data-testid="ride-request-seat"
              onClick={() => rides.openJoinModal(ride)}
            >
              🚕 Request Seat
            </button>
          ))}
        {/* Driver controls: accept requests, then start, then end (which pays out) */}
        {isDriver && ride.status !== "completed" && ride.status !== "cancelled" && (
          <button
            className="btn btn-sm btn-secondary"
            data-testid="ride-manage"
            onClick={() => rides.toggleManage(ride.id)}
          >
            👥 {rides.manageOpen[ride.id] ? "Hide requests" : "Manage requests"}
          </button>
        )}
        {isDriver && ride.status === "scheduled" && (
          <button
            className="btn btn-sm btn-primary"
            data-testid="ride-start"
            disabled={rides.busyRide === ride.id}
            onClick={() => rides.lifecycleAction(ride.id, "start")}
          >
            ▶ Start Ride
          </button>
        )}
        {isDriver && ride.status === "active" && (
          <button
            className="btn btn-sm btn-primary"
            data-testid="ride-end"
            disabled={rides.busyRide === ride.id}
            onClick={() => rides.lifecycleAction(ride.id, "end")}
          >
            ⏹ End Ride &amp; Collect Fare
          </button>
        )}
        {isParticipant && (ride.status === "active" || ride.status === "completed") && (
          <button
            className="btn btn-sm btn-secondary"
            data-testid="ride-split"
            onClick={() => rides.loadSplit(ride.id)}
          >
            💸 Fare Splitter
          </button>
        )}
        {chatOpen && (
          <Link
            href={`/dashboard/chat/${ride.id}`}
            className="btn btn-sm btn-secondary"
            data-testid="ride-chat"
          >
            💬 Ride Chat
          </Link>
        )}
        {isParticipant && (
          <Link
            href="/dashboard"
            className="btn btn-sm btn-secondary"
            data-testid="ride-track"
          >
            🗺️ Live Map Tracking
          </Link>
        )}
        {/* Feature 18: only offered while this user still has a live seat / ride */}
        {canCancel && (
          <button
            className="btn btn-sm btn-danger"
            data-testid="ride-cancel"
            onClick={() => rides.openCancelModal(ride)}
          >
            ✖ {isDriver ? "Cancel Ride" : "Cancel My Seat"}
          </button>
        )}
      </div>

      {rides.manageOpen[ride.id] && (
        <div
          data-testid="ride-requests"
          style={{
            marginTop: 16,
            padding: 16,
            background: "var(--surface)",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--surface-border)",
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 10, fontSize: "0.92rem" }}>
            👥 Seat requests
          </div>
          {rides.manageOpen[ride.id].length === 0 ? (
            <p style={{ fontSize: "0.85rem", color: "var(--text-tertiary)" }}>
              Nobody has requested a seat yet.
            </p>
          ) : (
            rides.manageOpen[ride.id].map((pp) => (
              <div
                key={pp.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                  flexWrap: "wrap",
                  padding: "8px 0",
                  borderTop: "1px solid var(--surface-border)",
                }}
              >
                <div style={{ fontSize: "0.85rem" }}>
                  <strong style={{ color: "var(--text-primary)" }}>{pp.passenger_name}</strong>
                  <span style={{ color: "var(--text-tertiary)" }}>
                    {" "}
                    · {pp.seats} seat{pp.seats === 1 ? "" : "s"}
                    {pp.pickup_stop
                      ? ` · ${rides.getHotspotName(pp.pickup_stop)} → ${rides.getHotspotName(pp.dropoff_stop)}`
                      : ""}
                  </span>
                </div>
                {pp.status === "requested" ? (
                  <button
                    className="btn btn-sm btn-primary"
                    data-testid="ride-accept"
                    disabled={rides.busyRide === ride.id}
                    onClick={() => rides.acceptPassenger(ride.id, pp.id, pp.passenger_name)}
                  >
                    ✓ Accept
                  </button>
                ) : (
                  <span
                    className={`badge ${pp.status === "cancelled" ? "badge-danger" : "badge-success"}`}
                  >
                    {pp.status}
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {s && (
        <div
          data-testid="ride-split-panel"
          style={{
            marginTop: 16,
            padding: 16,
            background: "var(--surface)",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--surface-border)",
          }}
        >
          <div
            style={{
              fontWeight: 700,
              marginBottom: 8,
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <span>💸 Fair Campus Cost Split</span>
            <span style={{ color: "var(--primary)" }}>{s.passenger_count} Passenger(s)</span>
          </div>
          <div
            style={{
              fontSize: "0.85rem",
              display: "grid",
              gap: 6,
              color: "var(--text-secondary)",
            }}
          >
            <div>
              Base fare: ৳{s.base_fare} {s.surge_multiplier > 1 ? `× surge ${s.surge_multiplier}` : ""}
            </div>
            <div>
              Total Ride Cost: <strong style={{ color: "var(--text-primary)" }}>৳{s.total}</strong>
            </div>
            <div
              style={{
                color: "var(--primary)",
                fontWeight: 700,
                fontSize: "1.05rem",
                marginTop: 4,
              }}
            >
              Estimated per seat: ৳{s.per_seat ?? "—"}
            </div>
          </div>
          {s.breakdown.length > 0 && (
            <div
              style={{
                marginTop: 10,
                paddingTop: 10,
                borderTop: "1px solid rgba(255,255,255,0.06)",
                fontSize: "0.8rem",
                color: "var(--text-secondary)",
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Individual Passenger Shares:</div>
              {s.breakdown.map((b, i) => (
                <div
                  key={i}
                  style={{ display: "flex", justifyContent: "space-between", padding: "2px 0" }}
                >
                  <span>
                    • {b.passenger} {b.seats > 1 ? `(${b.seats} seats)` : ""}
                    {b.pickup_stop && b.dropoff_stop
                      ? ` [${rides.getHotspotName(b.pickup_stop)} ➜ ${rides.getHotspotName(b.dropoff_stop)}]`
                      : ""}
                  </span>
                  <strong style={{ color: "var(--text-primary)" }}>৳{b.share}</strong>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
