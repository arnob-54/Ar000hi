"use client";

// Smart-match tab: the search form (pickup/destination/class time/female-only)
// plus the scored result cards. All matching logic lives in `useRides`.

import type { RidesController } from "./useRides";

export function MatchTab({ rides }: { rides: RidesController }) {
  const {
    hotspots,
    classSchedules,
    matchPickup,
    setMatchPickup,
    matchDropoff,
    setMatchDropoff,
    matchClassTime,
    setMatchClassTime,
    matchFemaleOnly,
    setMatchFemaleOnly,
    matchResults,
    matchingLoading,
    matchSearched,
    getHotspotName,
    openJoinModal,
  } = rides;

  return (
    <div style={{ marginBottom: 32 }} data-testid="match-tab">
      <div className="glass-card" style={{ padding: 24, marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <span style={{ fontSize: "1.5rem" }}>🎯</span>
          <div>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 700 }}>Campus Zone Smart Matcher</h3>
            <p style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>
              Algorithmically matches your route, pickup gate, intermediate stops, and class
              timetable with available carpools.
            </p>
          </div>
        </div>

        <form
          onSubmit={rides.handleSmartMatch}
          style={{ display: "flex", flexDirection: "column", gap: 16 }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 16,
            }}
          >
            <div className="input-group">
              <label className="input-label">Pickup Hotspot (From)</label>
              <select
                className="input select"
                required
                data-testid="match-pickup"
                value={matchPickup}
                onChange={(e) => setMatchPickup(e.target.value)}
              >
                <option value="">Select pickup point</option>
                {hotspots.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name} ({h.category.replace("_", " ")})
                  </option>
                ))}
              </select>
            </div>

            <div className="input-group">
              <label className="input-label">Destination Hotspot (To)</label>
              <select
                className="input select"
                required
                data-testid="match-dropoff"
                value={matchDropoff}
                onChange={(e) => setMatchDropoff(e.target.value)}
              >
                <option value="">Select destination</option>
                {hotspots.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="input-group">
              <label className="input-label">Target Class Time / Schedule</label>
              <input
                className="input"
                type="time"
                data-testid="match-class-time"
                value={matchClassTime}
                onChange={(e) => setMatchClassTime(e.target.value)}
              />
            </div>
          </div>

          {/* Quick Class Presets */}
          <div>
            <div
              style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: 6 }}
            >
              Class Schedule Quick Presets:
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {classSchedules.map((c) => (
                <button
                  key={c.time}
                  type="button"
                  data-testid="match-preset"
                  onClick={() => setMatchClassTime(c.time)}
                  className="badge"
                  style={{
                    cursor: "pointer",
                    background:
                      matchClassTime === c.time ? "var(--primary)" : "rgba(255,255,255,0.08)",
                    color: matchClassTime === c.time ? "#031b14" : "var(--text-primary)",
                    padding: "4px 10px",
                    border: "none",
                    fontSize: "0.75rem",
                  }}
                >
                  🕒 {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Female Only Checkbox */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                cursor: "pointer",
                fontSize: "0.9rem",
                color: "#f472b6",
              }}
            >
              <input
                type="checkbox"
                data-testid="match-female-only"
                checked={matchFemaleOnly}
                onChange={(e) => setMatchFemaleOnly(e.target.checked)}
              />
              <span>🌸 Show only Female-Only Verified Carpools</span>
            </label>

            <button
              type="submit"
              className="btn btn-primary"
              data-testid="match-submit"
              disabled={matchingLoading}
            >
              {matchingLoading ? "Matching Routes..." : "🔍 Find Best Matches"}
            </button>
          </div>
        </form>
      </div>

      {/* Match Results */}
      {matchSearched && (
        <div>
          <h3 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: 12 }}>
            Smart Match Recommendations ({matchResults.length})
          </h3>
          {matchResults.length === 0 ? (
            <div
              className="glass-card"
              style={{ padding: 24, textAlign: "center", color: "var(--text-secondary)" }}
            >
              No compatible rides found matching this exact route and time. Try adjusting your
              time or pickup hotspot, or offer a new ride!
            </div>
          ) : (
            <div style={{ display: "grid", gap: 16 }}>
              {matchResults.map((result, idx) => (
                <div
                  key={idx}
                  data-testid="match-card"
                  className="glass-card"
                  style={{
                    padding: 20,
                    border: `1px solid ${
                      result.score_percentage >= 80
                        ? "rgba(0, 212, 170, 0.5)"
                        : "var(--surface-border)"
                    }`,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      marginBottom: 12,
                      flexWrap: "wrap",
                      gap: 8,
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span
                          className="badge"
                          style={{
                            background:
                              result.score_percentage >= 80
                                ? "var(--success-muted)"
                                : "var(--warning-muted)",
                            color:
                              result.score_percentage >= 80
                                ? "var(--success)"
                                : "var(--warning)",
                            fontWeight: 800,
                            fontSize: "0.85rem",
                          }}
                        >
                          ⚡ {result.score_percentage}% Match Score
                        </span>
                        {result.ride?.female_only && (
                          <span
                            className="badge"
                            style={{ background: "rgba(236, 72, 153, 0.2)", color: "#f472b6" }}
                          >
                            🌸 Female-Only
                          </span>
                        )}
                      </div>
                      <div style={{ fontWeight: 700, fontSize: "1.1rem", marginTop: 8 }}>
                        📍 {getHotspotName(result.ride?.source || "")} ➜ 🏁{" "}
                        {getHotspotName(result.ride?.destination || "")}
                      </div>
                      <div
                        style={{
                          fontSize: "0.8rem",
                          color: "var(--text-secondary)",
                          marginTop: 4,
                        }}
                      >
                        Driver: <strong>{result.ride?.driver_name}</strong> · Base Fare: ৳
                        {result.ride?.base_fare} · Available Seats: {result.ride?.total_seats}
                      </div>
                    </div>

                    <button
                      className="btn btn-primary"
                      data-testid="match-join"
                      onClick={() => result.ride && openJoinModal(result.ride)}
                    >
                      🚕 Join Ride
                    </button>
                  </div>

                  {/* Matching Reasons Tags */}
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                    {(result.reasons || []).map((reason, rIdx) => (
                      <span
                        key={rIdx}
                        className="badge badge-info"
                        style={{ fontSize: "0.75rem", textTransform: "none" }}
                      >
                        ✓ {reason}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
