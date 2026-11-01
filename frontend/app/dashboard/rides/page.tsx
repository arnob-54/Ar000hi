"use client";

// Rides feature orchestrator. All state and network access lives in
// `useRides`; the presentation split lives in the sibling components. The
// route file only lays out the header, tabs, browse list and modals.

import { useState } from "react";

import { CancelRideModal } from "./CancelRideModal";
import { JoinRideModal } from "./JoinRideModal";
import { MatchTab } from "./MatchTab";
import { OfferForm } from "./OfferForm";
import { RideCard } from "./RideCard";
import type { MeInfo } from "./types";
import { useRides } from "./useRides";

function readMe(): MeInfo | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("user");
    return raw ? (JSON.parse(raw) as MeInfo) : null;
  } catch {
    return null;
  }
}

function readToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem("token");
  } catch {
    return null;
  }
}

export default function RidesPage() {
  const [me] = useState<MeInfo | null>(readMe);
  const [token] = useState<string | null>(readToken);
  const rides = useRides(token, me);

  const {
    activeTab,
    setActiveTab,
    notice,
    setNotice,
    setFilterType,
    filterType,
    surge,
    surgeBadge,
    upcomingPeaks,
    filteredAvailableRides,
    rides: rideLists,
    getHotspotName,
    reload,
  } = rides;

  // Group available rides by destination for the browse list.
  const groupedAvailable = filteredAvailableRides.reduce(
    (acc, ride) => {
      const dest = ride.destination;
      if (!acc[dest]) acc[dest] = [];
      acc[dest].push(ride);
      return acc;
    },
    {} as Record<string, typeof filteredAvailableRides>
  );

  return (
    <>
      <div className="page-header" style={{ marginBottom: 20 }}>
        <h1 className="page-title">🚗 BRACU Campus Rides</h1>
        <p className="page-subtitle">
          Smart matching · multi-stop carpools · female-only safe mode · advance class scheduling
        </p>
      </div>

      {notice && (
        <div
          data-testid="rides-notice"
          style={{
            padding: "12px 16px",
            borderRadius: "var(--radius-md)",
            fontSize: "0.85rem",
            marginBottom: 20,
            background:
              notice.type === "success" ? "var(--success-muted)" : "var(--danger-muted)",
            color: notice.type === "success" ? "var(--success)" : "var(--danger)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span>{notice.text}</span>
          <button
            onClick={() => setNotice(null)}
            style={{ background: "none", border: "none", color: "inherit", cursor: "pointer" }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Surge Indicator */}
      {surge && (
        <div
          className="glass-card"
          data-testid="surge-banner"
          style={{
            padding: 18,
            marginBottom: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: "1.6rem" }}>⚡</span>
            <div>
              <div style={{ fontWeight: 700 }}>Peak Hour Surge Status</div>
              <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                {surge.message}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className={`badge ${surgeBadge}`}>{surge.label}</span>
            <span style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--warning)" }}>
              ×{surge.multiplier}
            </span>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div
        role="tablist"
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 24,
          borderBottom: "1px solid var(--surface-border)",
          paddingBottom: 12,
        }}
      >
        <button
          role="tab"
          aria-selected={activeTab === "browse"}
          data-testid="rides-tab-browse"
          onClick={() => setActiveTab("browse")}
          className={`btn ${activeTab === "browse" ? "btn-primary" : "btn-secondary"}`}
          style={{ padding: "8px 18px", fontWeight: 600 }}
        >
          🔍 Browse Rides
        </button>
        <button
          role="tab"
          aria-selected={activeTab === "match"}
          data-testid="rides-tab-match"
          onClick={() => setActiveTab("match")}
          className={`btn ${activeTab === "match" ? "btn-primary" : "btn-secondary"}`}
          style={{
            padding: "8px 18px",
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span>⚡ Smart Match</span>
          <span className="badge badge-info" style={{ fontSize: "0.65rem", padding: "1px 6px" }}>
            AI
          </span>
        </button>
        <button
          role="tab"
          aria-selected={activeTab === "offer"}
          data-testid="rides-tab-offer"
          onClick={() => setActiveTab("offer")}
          className={`btn ${activeTab === "offer" ? "btn-primary" : "btn-secondary"}`}
          style={{ padding: "8px 18px", fontWeight: 600 }}
        >
          ➕ Offer Ride
        </button>
      </div>

      {activeTab === "match" && <MatchTab rides={rides} />}

      {activeTab === "offer" && <OfferForm rides={rides} />}

      {activeTab === "browse" && (
        <div data-testid="browse-tab">
          {/* Quick Filter Bar */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 16,
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => setFilterType("all")}
                className={`btn btn-sm ${filterType === "all" ? "btn-primary" : "btn-secondary"}`}
              >
                All Rides ({rideLists.available.length})
              </button>
              <button
                onClick={() => setFilterType("female")}
                className={`btn btn-sm ${filterType === "female" ? "btn-primary" : "btn-secondary"}`}
                style={{ color: filterType === "female" ? undefined : "#f472b6" }}
              >
                🌸 Female-Only
              </button>
              <button
                onClick={() => setFilterType("scheduled")}
                className={`btn btn-sm ${filterType === "scheduled" ? "btn-primary" : "btn-secondary"}`}
              >
                🕒 Scheduled Ahead
              </button>
            </div>

            <button onClick={reload} className="btn btn-sm btn-secondary" data-testid="rides-refresh">
              🔄 Refresh Live Rides
            </button>
          </div>

          {/* Upcoming peak strip */}
          {upcomingPeaks.length > 0 && (
            <div className="glass-card" style={{ padding: 14, marginBottom: 20 }}>
              <div style={{ fontWeight: 600, fontSize: "0.85rem", marginBottom: 8 }}>
                ⏰ Upcoming BRACU Peak Windows
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {upcomingPeaks.map((h) => (
                  <span
                    key={h.hour}
                    className={`badge ${h.multiplier >= 1.5 ? "badge-danger" : "badge-warning"}`}
                    style={{ textTransform: "none" }}
                  >
                    {h.hour.toString().padStart(2, "0")}:00 — ×{h.multiplier} {h.label}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* My Rides */}
          <h3 style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: 12 }}>
            My Active &amp; Created Rides
          </h3>
          <div style={{ display: "grid", gap: 14, marginBottom: 32 }}>
            {rideLists.mine.length === 0 && (
              <div
                className="glass-card"
                style={{ padding: 18, color: "var(--text-tertiary)", fontSize: "0.9rem" }}
              >
                You haven&apos;t joined or created any active rides yet. Browse available campus
                rides below or offer one!
              </div>
            )}
            {rideLists.mine.map((ride) => (
              <RideCard key={ride.id} ride={ride} mine={true} rides={rides} />
            ))}
          </div>

          {/* Available Campus Rides grouped by Destination */}
          <h3 style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: 12 }}>
            Available Campus Carpools
          </h3>
          <div style={{ display: "grid", gap: 20 }}>
            {filteredAvailableRides.length === 0 && (
              <div
                className="glass-card"
                style={{
                  padding: 24,
                  textAlign: "center",
                  color: "var(--text-tertiary)",
                  fontSize: "0.9rem",
                }}
              >
                No rides available matching the selected filter. Check back soon or switch to
                Smart Matching!
              </div>
            )}

            {Object.entries(groupedAvailable).map(([dest, groupRides]) => (
              <div key={dest}>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: "0.95rem",
                    color: "var(--primary)",
                    marginBottom: 10,
                    paddingBottom: 4,
                    borderBottom: "1px solid var(--surface-border)",
                  }}
                >
                  📍 Heading to {getHotspotName(dest)} ({groupRides.length} available)
                </div>
                <div style={{ display: "grid", gap: 12 }}>
                  {groupRides.map((ride) => (
                    <RideCard key={ride.id} ride={ride} mine={false} rides={rides} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <JoinRideModal rides={rides} />
      <CancelRideModal rides={rides} />
    </>
  );
}
