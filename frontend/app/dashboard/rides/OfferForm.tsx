"use client";

// Driver offer form: route, fare, seats, advance scheduling, female-only mode
// and intermediate waypoints. Submission lives in `useRides.createRide`.

import type { RidesController } from "./useRides";

export function OfferForm({ rides }: { rides: RidesController }) {
  const { form, setForm, hotspots, me, loading } = rides;

  return (
    <div className="glass-card" style={{ padding: 24, marginBottom: 32 }} data-testid="offer-form">
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <span style={{ fontSize: "1.5rem" }}>🚘</span>
        <div>
          <h3 style={{ fontSize: "1.1rem", fontWeight: 700 }}>Offer a Campus Ride</h3>
          <p style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>
            Share your car or bike with fellow BRACU students. Add intermediate campus gates or
            transit stops to maximize carpool occupancy.
          </p>
        </div>
      </div>

      <form
        onSubmit={rides.createRide}
        style={{ display: "flex", flexDirection: "column", gap: 18 }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 16,
          }}
        >
          <div className="input-group">
            <label className="input-label">Pickup Hotspot (From)</label>
            <select
              className="input select"
              required
              value={form.source}
              onChange={(e) => setForm({ ...form, source: e.target.value })}
            >
              <option value="">Select pickup point</option>
              {hotspots.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
          </div>

          <div className="input-group">
            <label className="input-label">Destination Hotspot (To)</label>
            <select
              className="input select"
              required
              value={form.destination}
              onChange={(e) => setForm({ ...form, destination: e.target.value })}
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
            <label className="input-label">Base Fare (৳)</label>
            <input
              className="input"
              type="number"
              min="10"
              step="5"
              required
              placeholder="e.g. 100"
              value={form.base_fare}
              onChange={(e) => setForm({ ...form, base_fare: e.target.value })}
            />
          </div>

          <div className="input-group">
            <label className="input-label">Available Seats</label>
            <input
              className="input"
              type="number"
              min="1"
              max="10"
              required
              value={form.total_seats}
              onChange={(e) => setForm({ ...form, total_seats: e.target.value })}
            />
          </div>
        </div>

        {/* Advance Scheduling & Female-Only Option */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 16,
            alignItems: "center",
          }}
        >
          <div className="input-group">
            <label className="input-label">Schedule Advance Booking (Optional)</label>
            <input
              className="input"
              type="datetime-local"
              value={form.scheduled_at}
              onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })}
            />
          </div>

          {me?.gender === "female" && (
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                cursor: "pointer",
                fontWeight: 600,
                color: "#f472b6",
                paddingTop: 20,
              }}
            >
              <input
                type="checkbox"
                data-testid="offer-female-only"
                checked={form.female_only}
                onChange={(e) => setForm({ ...form, female_only: e.target.checked })}
              />
              <span>🌸 Female-Only Mode (Only female riders can view &amp; join)</span>
            </label>
          )}
        </div>

        {/* Intermediate Multi-Stop Waypoints */}
        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 8,
            }}
          >
            <label className="input-label" style={{ marginBottom: 0 }}>
              Intermediate Campus Stops (Multi-Stop Support)
            </label>
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              data-testid="offer-add-stop"
              onClick={() => setForm({ ...form, stops: [...form.stops, ""] })}
            >
              + Add Stop
            </button>
          </div>

          {form.stops.length > 0 ? (
            <div style={{ display: "grid", gap: 8 }}>
              {form.stops.map((stop, idx) => (
                <div key={idx} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span
                    style={{ fontSize: "0.8rem", color: "var(--text-secondary)", width: 60 }}
                  >
                    Stop {idx + 1}:
                  </span>
                  <select
                    className="input select"
                    style={{ flex: 1 }}
                    value={stop}
                    onChange={(e) => {
                      const updated = [...form.stops];
                      updated[idx] = e.target.value;
                      setForm({ ...form, stops: updated });
                    }}
                  >
                    <option value="">Select waypoint stop</option>
                    {hotspots.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ padding: "6px 12px" }}
                    aria-label={`Remove stop ${idx + 1}`}
                    onClick={() =>
                      setForm({ ...form, stops: form.stops.filter((_, i) => i !== idx) })
                    }
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: "0.8rem", color: "var(--text-tertiary)" }}>
              No intermediate stops added yet. Direct route from source to destination.
            </div>
          )}
        </div>

        <button
          type="submit"
          className="btn btn-primary"
          data-testid="offer-submit"
          style={{ marginTop: 8 }}
          disabled={loading}
        >
          {loading ? "Publishing Ride..." : "Publish Ride Offer"}
        </button>
      </form>
    </div>
  );
}
