"use client";

// Feature 18 cancellation dialog. The penalty preview is fetched before this
// opens, so the fee shown is the fee charged.

import type { RidesController } from "./useRides";

export function CancelRideModal({ rides }: { rides: RidesController }) {
  const {
    cancelTarget,
    setCancelTarget,
    cancelQuote,
    cancelReason,
    setCancelReason,
    cancelling,
    confirmCancel,
  } = rides;

  if (!cancelTarget) return null;

  return (
    <div
      className="modal-backdrop"
      data-testid="cancel-modal"
      onClick={() => !cancelling && setCancelTarget(null)}
    >
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 460 }}
      >
        <div className="modal-title">
          {cancelQuote?.role === "driver" ? "Cancel this ride?" : "Cancel your seat?"}
        </div>

        <div
          style={{ fontSize: "0.86rem", color: "var(--text-secondary)", marginBottom: 14 }}
        >
          {cancelTarget.source} to {cancelTarget.destination}
        </div>

        {!cancelQuote ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 24 }}>
            <span className="spinner" />
          </div>
        ) : (
          <>
            <div
              style={{
                padding: "12px 14px",
                borderRadius: "var(--radius-md)",
                borderLeft: `3px solid ${
                  cancelQuote.will_be_charged ? "var(--danger)" : "var(--success)"
                }`,
                background: cancelQuote.will_be_charged
                  ? "var(--danger-muted)"
                  : "var(--success-muted)",
                marginBottom: 14,
              }}
            >
              <div
                style={{
                  fontWeight: 700,
                  fontSize: "0.9rem",
                  color: cancelQuote.will_be_charged ? "var(--danger)" : "var(--success)",
                  marginBottom: 4,
                }}
              >
                {cancelQuote.will_be_charged
                  ? `⚠️ Late-cancellation fee: ৳${cancelQuote.penalty.toFixed(2)}`
                  : "✅ Free to cancel"}
              </div>
              <div
                style={{ fontSize: "0.8rem", color: "var(--text-secondary)", lineHeight: 1.6 }}
              >
                {cancelQuote.reason}
              </div>
            </div>

            {cancelQuote.will_be_charged && (
              <div
                style={{
                  fontSize: "0.76rem",
                  color: "var(--text-tertiary)",
                  marginBottom: 14,
                  lineHeight: 1.7,
                }}
              >
                Your share of this ride: ৳{cancelQuote.exposure.toFixed(2)} &middot; fee is{" "}
                {Math.round(cancelQuote.policy.penalty_rate * 100)}% (min ৳
                {cancelQuote.policy.min_penalty.toFixed(0)}, max ৳
                {cancelQuote.policy.max_penalty.toFixed(0)}).
                <br />
                Wallet balance: ৳{cancelQuote.wallet_balance.toFixed(2)}
                {cancelQuote.wallet_balance < cancelQuote.penalty && (
                  <span style={{ color: "var(--warning)" }}>
                    {" "}
                    — not enough to cover the fee; it will be recorded as unpaid.
                  </span>
                )}
              </div>
            )}

            <div className="input-group">
              <label className="input-label">Reason (optional)</label>
              <input
                className="input"
                data-testid="cancel-reason"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="e.g. class got cancelled"
                maxLength={300}
              />
            </div>

            <div className="modal-actions">
              <button
                className="btn btn-ghost"
                data-testid="cancel-keep"
                disabled={cancelling}
                onClick={() => setCancelTarget(null)}
              >
                Keep the ride
              </button>
              <button
                className="btn btn-danger"
                data-testid="cancel-confirm"
                disabled={cancelling}
                onClick={confirmCancel}
              >
                {cancelling ? (
                  <span className="spinner" />
                ) : cancelQuote.will_be_charged ? (
                  `Cancel and pay ৳${cancelQuote.penalty.toFixed(2)}`
                ) : (
                  "Yes, cancel"
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
