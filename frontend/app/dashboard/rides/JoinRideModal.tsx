"use client";

// Multi-stop join dialog: pick the boarding/alighting stop along the driver's
// route and the number of seats. The actual POST lives in `useRides`.

import { stopPlace } from "./types";
import type { RidesController } from "./useRides";

export function JoinRideModal({ rides }: { rides: RidesController }) {
  const {
    joiningRide,
    setJoiningRide,
    joinPickupStop,
    setJoinPickupStop,
    joinDropoffStop,
    setJoinDropoffStop,
    joinSeats,
    setJoinSeats,
    bookingRide,
    executeJoinRide,
    getHotspotName,
  } = rides;

  if (!joiningRide) return null;

  return (
    <div
      data-testid="join-modal"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        background: "rgba(0,0,0,0.7)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: 16,
      }}
    >
      <div
        className="glass-card"
        style={{
          width: "100%",
          maxWidth: 480,
          padding: 24,
          background: "var(--surface)",
          border: "1px solid var(--primary)",
        }}
      >
        <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: 12 }}>
          🚕 Select Your Pickup &amp; Drop-Off Stops
        </h3>
        <p style={{ fontSize: "0.82rem", color: "var(--text-secondary)", marginBottom: 16 }}>
          This driver is making multiple stops. Choose where you would like to be picked up and
          dropped off along the route.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="input-group">
            <label className="input-label">Your Pickup Stop</label>
            <select
              className="input select"
              data-testid="join-pickup"
              value={joinPickupStop}
              onChange={(e) => setJoinPickupStop(e.target.value)}
            >
              <option value={joiningRide.source}>
                Source: {getHotspotName(joiningRide.source)}
              </option>
              {joiningRide.stops?.map((stop, idx) => (
                <option key={idx} value={stopPlace(stop)}>
                  Stop {idx + 1}: {getHotspotName(stop)}
                </option>
              ))}
            </select>
          </div>

          <div className="input-group">
            <label className="input-label">Your Drop-Off Stop</label>
            <select
              className="input select"
              data-testid="join-dropoff"
              value={joinDropoffStop}
              onChange={(e) => setJoinDropoffStop(e.target.value)}
            >
              {joiningRide.stops?.map((stop, idx) => (
                <option key={idx} value={stopPlace(stop)}>
                  Stop {idx + 1}: {getHotspotName(stop)}
                </option>
              ))}
              <option value={joiningRide.destination}>
                Final: {getHotspotName(joiningRide.destination)}
              </option>
            </select>
          </div>

          <div className="input-group">
            <label className="input-label">Seats Required</label>
            <input
              className="input"
              type="number"
              min="1"
              max={joiningRide.available_seats ?? joiningRide.total_seats}
              data-testid="join-seats"
              value={joinSeats}
              onChange={(e) => setJoinSeats(Number(e.target.value))}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
            <button
              className="btn btn-secondary"
              data-testid="join-cancel"
              onClick={() => setJoiningRide(null)}
            >
              Cancel
            </button>
            <button
              className="btn btn-primary"
              data-testid="join-confirm"
              onClick={executeJoinRide}
              disabled={bookingRide}
            >
              {bookingRide ? "Requesting Seat..." : "Confirm & Request Seat"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
