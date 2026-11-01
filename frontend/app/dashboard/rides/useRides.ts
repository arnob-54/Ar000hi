"use client";

// All rides-page state and side effects. The route file is now only layout:
// tab switching, the browse lists and the three modals live in components.
//
// Data access goes through `apiFetch`, so the bearer token, `{detail}` errors
// and 401 session expiry are handled in one place. The initial load carries an
// AbortSignal so navigating away cannot apply a stale response.

import { useCallback, useEffect, useRef, useState } from "react";

import { ApiError, apiFetch } from "@/lib/client";
import { surgeBadgeClass } from "@/lib/badges";
import {
  CLASS_SCHEDULES,
  EMPTY_RIDE_FORM,
  type CancelQuote,
  type Hotspot,
  type MatchCandidate,
  type MatchResult,
  type MeInfo,
  type RideForm,
  type RideInfo,
  type RidePassenger,
  type SplitInfo,
  type StopInfo,
  type SurgeHour,
  type SurgeInfo,
  stopPlace,
} from "./types";

type Notice = { type: "success" | "error"; text: string } | null;

export function useRides(token: string | null, me: MeInfo | null) {
  const [activeTab, setActiveTab] = useState<"browse" | "match" | "offer">("browse");
  const [filterType, setFilterType] = useState<"all" | "female" | "scheduled">("all");
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [surge, setSurge] = useState<SurgeInfo | null>(null);
  const [schedule, setSchedule] = useState<SurgeHour[]>([]);
  const [rides, setRides] = useState<{ mine: RideInfo[]; available: RideInfo[] }>({
    mine: [],
    available: [],
  });
  const [form, setForm] = useState<RideForm>(EMPTY_RIDE_FORM);

  // Smart Matching State
  const [matchPickup, setMatchPickup] = useState("");
  const [matchDropoff, setMatchDropoff] = useState("");
  const [matchClassTime, setMatchClassTime] = useState("");
  const [matchFemaleOnly, setMatchFemaleOnly] = useState(false);
  const [matchResults, setMatchResults] = useState<MatchResult[]>([]);
  const [matchingLoading, setMatchingLoading] = useState(false);
  const [matchSearched, setMatchSearched] = useState(false);

  // Multi-Stop Join Modal State
  const [joiningRide, setJoiningRide] = useState<RideInfo | null>(null);
  const [joinPickupStop, setJoinPickupStop] = useState("");
  const [joinDropoffStop, setJoinDropoffStop] = useState("");
  const [joinSeats, setJoinSeats] = useState(1);
  const [bookingRide, setBookingRide] = useState(false);

  const [split, setSplit] = useState<Record<string, SplitInfo>>({});
  // Feature 18: Ride Cancellation Policy & Penalty
  const [cancelTarget, setCancelTarget] = useState<RideInfo | null>(null);
  const [cancelQuote, setCancelQuote] = useState<CancelQuote | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  // Ride lifecycle: accept requests, start the ride, end it (which settles the fare)
  const [manageOpen, setManageOpen] = useState<Record<string, RidePassenger[]>>({});
  const [busyRide, setBusyRide] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    };
  }, []);

  const showNotice = useCallback((type: "success" | "error", text: string) => {
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    setNotice({ type, text });
    noticeTimer.current = setTimeout(() => setNotice(null), 5000);
  }, []);

  // Data fetching only — no setState here, so both the initial-load
  // effect (below, .then style) and the event handlers (via reload)
  // can reuse it without cascading renders.
  const fetchRideData = useCallback(
    async (
      signal?: AbortSignal
    ): Promise<
      [
        SurgeInfo | null,
        SurgeHour[],
        { mine: RideInfo[]; available: RideInfo[] },
        Hotspot[],
      ]
    > =>
      Promise.all([
        apiFetch<SurgeInfo>("/surge/current", { signal }).catch(() => null),
        apiFetch<{ schedule?: SurgeHour[] }>("/surge/schedule", { signal })
          .then((d) => d?.schedule ?? [])
          .catch(() => []),
        apiFetch<{ mine: RideInfo[]; available: RideInfo[] }>("/rides", { signal }).catch(
          () => ({ mine: [], available: [] })
        ),
        apiFetch<Hotspot[]>("/rides/hotspots", { signal }).catch(() => []),
      ]),
    []
  );

  const reload = useCallback(async () => {
    try {
      const [s, sc, r, h] = await fetchRideData();
      setSurge(s);
      setSchedule(sc);
      setRides(r);
      setHotspots(h);
    } catch (err) {
      console.error("Error loading ride data", err);
    }
  }, [fetchRideData]);

  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    fetchRideData(controller.signal)
      .then(([s, sc, r, h]) => {
        if (controller.signal.aborted) return;
        setSurge(s);
        setSchedule(sc);
        setRides(r);
        setHotspots(h);
      })
      .catch((err) => {
        if (!controller.signal.aborted) console.error("Error loading ride data", err);
      });
    return () => controller.abort();
  }, [fetchRideData, token]);

  const handleSmartMatch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!token || !matchPickup || !matchDropoff) {
      showNotice("error", "Please select both pickup and destination hotspots for smart matching");
      return;
    }
    setMatchingLoading(true);
    setMatchSearched(true);
    try {
      let path = `/rides/match?pickup=${encodeURIComponent(matchPickup)}&dropoff=${encodeURIComponent(matchDropoff)}`;
      if (matchClassTime) path += `&class_time=${encodeURIComponent(matchClassTime)}`;
      if (matchFemaleOnly) path += "&female_only=true";

      const data = await apiFetch<MatchCandidate[] | { matches?: MatchCandidate[] }>(path);
      const rawList = Array.isArray(data) ? data : data.matches || [];
      const normalized: MatchResult[] = rawList.map((item: MatchCandidate) => {
        if (item.ride) {
          return {
            ride: item.ride,
            match_score: item.match_score || item.score_percentage || 100,
            score_percentage: item.score_percentage || item.match_score || 100,
            reasons: item.reasons || item.match_reasons || [],
            pickup_distance_km: item.pickup_distance_km || 0,
            dropoff_distance_km: item.dropoff_distance_km || 0,
            time_difference_mins: item.time_difference_mins ?? null,
          };
        }
        return {
          ride: {
            id: item.id ?? "",
            driver_id: item.driver_id ?? "",
            driver_name: item.driver_name ?? "",
            source: item.source ?? "",
            destination: item.destination ?? "",
            status: item.status ?? "",
            distance_km: item.distance_km ?? null,
            base_fare: item.base_fare ?? 0,
            surge_multiplier: item.surge_multiplier ?? 1,
            total_seats: item.total_seats ?? 0,
            available_seats: item.available_seats,
            scheduled_at: item.scheduled_at,
            female_only: item.female_only,
            stops: item.stops,
          },
          match_score: item.match_score || 100,
          score_percentage: item.match_score || 100,
          reasons: item.match_reasons || item.reasons || [],
          pickup_distance_km: 0,
          dropoff_distance_km: 0,
          time_difference_mins: null,
        };
      });
      setMatchResults(normalized);
    } catch (err) {
      showNotice(
        "error",
        err instanceof ApiError ? err.message : "Network error during smart matching"
      );
      setMatchResults([]);
      if (!(err instanceof ApiError)) console.error(err);
    } finally {
      setMatchingLoading(false);
    }
  };

  const createRide = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setLoading(true);
    try {
      const data = await apiFetch<{ message?: string }>("/rides", {
        method: "POST",
        body: {
          source: form.source,
          destination: form.destination,
          base_fare: Number(form.base_fare),
          total_seats: Number(form.total_seats),
          scheduled_at: form.scheduled_at
            ? new Date(form.scheduled_at).toISOString()
            : undefined,
          female_only: form.female_only,
          stops: form.stops.filter((s) => s.trim() !== ""),
        },
      });
      setForm(EMPTY_RIDE_FORM);
      showNotice("success", data.message || "Ride offered successfully");
      reload();
      setActiveTab("browse");
    } catch (err) {
      showNotice("error", err instanceof ApiError ? err.message : "Network error — could not create ride");
      if (!(err instanceof ApiError)) console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const openJoinModal = (ride: RideInfo) => {
    setJoiningRide(ride);
    setJoinPickupStop(ride.source);
    setJoinDropoffStop(ride.destination);
    setJoinSeats(1);
  };

  const executeJoinRide = async () => {
    if (!token || !joiningRide || bookingRide) return;
    const availableSeats = joiningRide.available_seats ?? joiningRide.total_seats;
    if (availableSeats < 1) {
      showNotice("error", "This carpool is already full.");
      setJoiningRide(null);
      return;
    }
    if (!Number.isInteger(joinSeats) || joinSeats < 1 || joinSeats > availableSeats) {
      showNotice(
        "error",
        `Choose between 1 and ${availableSeats} available seat${availableSeats === 1 ? "" : "s"}.`
      );
      return;
    }
    setBookingRide(true);
    try {
      const data = await apiFetch<{
        requires_topup?: boolean;
        topup_amount?: number;
        message?: string;
      }>(`/rides/${joiningRide.id}/join`, {
        method: "POST",
        body: {
          seats: joinSeats,
          pickup_stop: joinPickupStop || undefined,
          dropoff_stop: joinDropoffStop || undefined,
        },
      });
      showNotice(
        "success",
        data.requires_topup
          ? `Seat requested. Add ৳${data.topup_amount} to your wallet before the ride ends.`
          : data.message || "Seat requested successfully!"
      );
      setJoiningRide(null);
      reload();
    } catch (err) {
      showNotice("error", err instanceof ApiError ? err.message : "Network error — could not join ride");
      if (!(err instanceof ApiError)) console.error(err);
    } finally {
      setBookingRide(false);
    }
  };

  const updateStopStatus = async (
    rideId: string,
    stopId: string,
    status: "reached" | "departed"
  ) => {
    if (!token) return;
    try {
      await apiFetch(`/rides/${rideId}/stops/${stopId}/status`, {
        method: "PUT",
        body: { status },
      });
      showNotice("success", `Stop marked as ${status}`);
      reload();
    } catch (err) {
      showNotice(
        "error",
        err instanceof ApiError ? err.message : "Network error updating stop status"
      );
      if (!(err instanceof ApiError)) console.error(err);
    }
  };

  // ---- Ride lifecycle -------------------------------------------------------
  const toggleManage = async (rideId: string) => {
    if (manageOpen[rideId]) {
      setManageOpen((prev) => {
        const next = { ...prev };
        delete next[rideId];
        return next;
      });
      return;
    }
    try {
      const data = await apiFetch<{ passengers?: RidePassenger[] }>(`/rides/${rideId}`);
      setManageOpen((prev) => ({ ...prev, [rideId]: data.passengers || [] }));
    } catch (e) {
      showNotice("error", e instanceof Error ? e.message : String(e));
    }
  };

  const acceptPassenger = async (rideId: string, passengerRowId: string, name: string) => {
    setBusyRide(rideId);
    try {
      await apiFetch(`/rides/${rideId}/accept/${passengerRowId}`, { method: "POST" });
      showNotice("success", `${name} is on board`);
      const refreshed = await apiFetch<{ passengers?: RidePassenger[] }>(`/rides/${rideId}`);
      setManageOpen((prev) => ({ ...prev, [rideId]: refreshed.passengers || [] }));
      reload();
    } catch (e) {
      showNotice("error", e instanceof Error ? e.message : String(e));
    } finally {
      setBusyRide(null);
    }
  };

  // Ending a ride is what settles the fare: riders are debited, the driver is
  // credited, and the trip becomes a receipt.
  const lifecycleAction = async (rideId: string, action: "start" | "end") => {
    setBusyRide(rideId);
    try {
      const data = await apiFetch<{ settlement?: { driver_credited?: number } }>(
        `/rides/${rideId}/${action}`,
        { method: "POST", body: action === "end" ? {} : undefined }
      );
      if (action === "end") {
        const paid = data.settlement?.driver_credited || 0;
        showNotice(
          "success",
          paid > 0
            ? `Ride completed — ৳${paid.toFixed(2)} paid into your wallet.`
            : "Ride completed."
        );
      } else {
        showNotice("success", "Ride started — you can now end it when you arrive.");
      }
      setManageOpen((prev) => {
        const next = { ...prev };
        delete next[rideId];
        return next;
      });
      reload();
    } catch (e) {
      showNotice("error", e instanceof Error ? e.message : String(e));
    } finally {
      setBusyRide(null);
    }
  };

  // Fetch the penalty preview BEFORE opening the dialog, so the warning shows the
  // same number that will actually be charged.
  const openCancelModal = async (ride: RideInfo) => {
    setCancelTarget(ride);
    setCancelQuote(null);
    setCancelReason("");
    try {
      const data = await apiFetch<CancelQuote>(`/rides/${ride.id}/cancellation-policy`);
      setCancelQuote(data);
    } catch (err) {
      showNotice(
        "error",
        err instanceof ApiError ? err.message : "Network error - could not check the cancellation policy"
      );
      setCancelTarget(null);
    }
  };

  const confirmCancel = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      const data = await apiFetch<{
        penalty_charged?: number;
        uncollected?: string;
        message?: string;
      }>(`/rides/${cancelTarget.id}/cancel`, {
        method: "POST",
        body: { reason: cancelReason },
      });
      const cancelledId = cancelTarget.id;
      const cancelledAsDriver = cancelQuote?.role === "driver";
      showNotice(
        data.penalty_charged && data.penalty_charged > 0 ? "success" : data.uncollected ? "error" : "success",
        data.message || "Ride cancelled"
      );
      setCancelTarget(null);
      setCancelQuote(null);
      setRides((prev) => ({
        mine: cancelledAsDriver
          ? prev.mine.map((r) => (r.id === cancelledId ? { ...r, status: "cancelled" } : r))
          : prev.mine.filter((r) => r.id !== cancelledId),
        available: prev.available,
      }));
      reload();
    } catch (err) {
      showNotice(
        "error",
        err instanceof ApiError ? err.message : "Network error - could not cancel the ride"
      );
    } finally {
      setCancelling(false);
    }
  };

  const loadSplit = async (rideId: string) => {
    if (split[rideId]) {
      setSplit({});
      return;
    }
    if (!token) return;
    try {
      const data = await apiFetch<SplitInfo>(`/rides/${rideId}/split`);
      setSplit({ [rideId]: data });
    } catch (err) {
      showNotice("error", err instanceof ApiError ? err.message : "Network error — could not load fare split");
      if (!(err instanceof ApiError)) console.error(err);
    }
  };

  const getHotspotName = (idOrName: string | { place?: string; stop_name?: string; name?: string; id?: string }) => {
    const name = stopPlace(idOrName);
    if (!name) return "";
    const found = hotspots.find(
      (h) =>
        h.id.toLowerCase() === name.toLowerCase() || h.name.toLowerCase() === name.toLowerCase()
    );
    return found ? found.name : name;
  };

  const surgeBadge = surge ? surgeBadgeClass(surge.label) : "badge-success";

  const upcomingPeaks = schedule
    .filter((h) => h.hour > (surge?.hour ?? -1))
    .slice(0, 6)
    .filter((h) => h.multiplier >= 1.3);

  const filteredAvailableRides = rides.available.filter((ride) => {
    if (filterType === "female") return ride.female_only;
    if (filterType === "scheduled") return !!ride.scheduled_at;
    return true;
  });

  return {
    token,
    me,
    activeTab,
    setActiveTab,
    filterType,
    setFilterType,
    hotspots,
    surge,
    schedule,
    rides,
    form,
    setForm,
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
    joiningRide,
    setJoiningRide,
    joinPickupStop,
    setJoinPickupStop,
    joinDropoffStop,
    setJoinDropoffStop,
    joinSeats,
    setJoinSeats,
    bookingRide,
    split,
    cancelTarget,
    setCancelTarget,
    cancelQuote,
    cancelReason,
    setCancelReason,
    cancelling,
    manageOpen,
    busyRide,
    loading,
    notice,
    setNotice,
    showNotice,
    reload,
    handleSmartMatch,
    createRide,
    openJoinModal,
    executeJoinRide,
    updateStopStatus,
    toggleManage,
    acceptPassenger,
    lifecycleAction,
    openCancelModal,
    confirmCancel,
    loadSplit,
    getHotspotName,
    surgeBadge,
    upcomingPeaks,
    filteredAvailableRides,
    classSchedules: CLASS_SCHEDULES,
  };
}

export type RidesController = ReturnType<typeof useRides>;

export type { StopInfo };
