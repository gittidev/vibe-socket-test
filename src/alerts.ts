import type { Server } from "socket.io";
import { getPatient } from "./data.js";
import type { VitalUpdate } from "./types.js";

export type AlertThresholds = {
  hrHigh?: number; hrLow?: number;
  sbpHigh?: number; sbpLow?: number;
  spo2Low?: number;
  tempHigh?: number;
  rrHigh?: number; rrLow?: number;
};

type RuleScope = {
  default: AlertThresholds;
  wards: Record<string, AlertThresholds>;
  patients: Record<string, AlertThresholds>;
};

const rules: RuleScope = {
  default: { hrHigh: 120, hrLow: 50, sbpHigh: 180, sbpLow: 85, spo2Low: 90, tempHigh: 38.5, rrHigh: 28, rrLow: 10 },
  wards: {},
  patients: {}
};

const lastAlertTs = new Map<string, number>();
const THROTTLE_MS = 60_000; // 60s per metric per patient

type Severity = "warning" | "critical";
type AlertItem = { key: string; message: string; severity: Severity };

const activeConditions = new Map<string, Set<string>>(); // patientId -> set of condition keys

function merge(a: AlertThresholds, b?: AlertThresholds): AlertThresholds {
  return { ...a, ...(b ?? {}) };
}

export function getAllRules() {
  return rules;
}

export function setDefaultRules(partial: AlertThresholds) {
  rules.default = merge(rules.default, partial);
}

export function setWardRules(ward: string, t: AlertThresholds) {
  rules.wards[ward] = merge(rules.wards[ward] ?? {}, t);
}

export function deleteWardRules(ward: string) {
  delete rules.wards[ward];
}

export function setPatientRules(patientId: string, t: AlertThresholds) {
  rules.patients[patientId] = merge(rules.patients[patientId] ?? {}, t);
}

export function deletePatientRules(patientId: string) {
  delete rules.patients[patientId];
}

function resolveThresholds(patientId: string): AlertThresholds {
  const p = getPatient(patientId);
  const ward = p?.ward;
  return merge(merge(rules.default, ward ? rules.wards[ward] : undefined), rules.patients[patientId]);
}

function toRoom(patientId: string) {
  return `patient:${patientId}`;
}

function shouldThrottle(key: string, now: number) {
  const last = lastAlertTs.get(key) ?? 0;
  if (now - last < THROTTLE_MS) return true;
  lastAlertTs.set(key, now);
  return false;
}

export function handleAlerts(io: Server, u: VitalUpdate) {
  const t = resolveThresholds(u.patientId);
  const now = u.timestamp ?? Date.now();
  const items: AlertItem[] = [];
  const currentKeys = new Set<string>();

  function sevHigh(val: number, high: number, metric: string): Severity {
    if (["spo2"].includes(metric)) {
      // not used for high side
      return "warning";
    }
    return val > high * 1.15 ? "critical" : "warning";
  }
  function sevLow(val: number, low: number, metric: string): Severity {
    if (metric === "spo2") return (low - val) >= 2 ? "critical" : "warning";
    if (metric === "temp") return (val < low - 1) ? "critical" : "warning";
    return val < low * 0.85 ? "critical" : "warning";
  }

  if (t.hrHigh !== undefined && u.hr > t.hrHigh) {
    const key = `${u.patientId}:hr:high`;
    currentKeys.add(key);
    if (!shouldThrottle(key, now)) items.push({ key, message: `High HR ${u.hr} (> ${t.hrHigh})`, severity: sevHigh(u.hr, t.hrHigh, "hr") });
  }
  if (t.hrLow !== undefined && u.hr < t.hrLow) {
    const key = `${u.patientId}:hr:low`;
    currentKeys.add(key);
    if (!shouldThrottle(key, now)) items.push({ key, message: `Low HR ${u.hr} (< ${t.hrLow})`, severity: sevLow(u.hr, t.hrLow, "hr") });
  }
  if (t.sbpHigh !== undefined && u.sbp > t.sbpHigh) {
    const key = `${u.patientId}:sbp:high`;
    currentKeys.add(key);
    if (!shouldThrottle(key, now)) items.push({ key, message: `High SBP ${u.sbp} (> ${t.sbpHigh})`, severity: sevHigh(u.sbp, t.sbpHigh, "sbp") });
  }
  if (t.sbpLow !== undefined && u.sbp < t.sbpLow) {
    const key = `${u.patientId}:sbp:low`;
    currentKeys.add(key);
    if (!shouldThrottle(key, now)) items.push({ key, message: `Low SBP ${u.sbp} (< ${t.sbpLow})`, severity: sevLow(u.sbp, t.sbpLow, "sbp") });
  }
  if (t.spo2Low !== undefined && u.spo2 < t.spo2Low) {
    const key = `${u.patientId}:spo2:low`;
    currentKeys.add(key);
    if (!shouldThrottle(key, now)) items.push({ key, message: `Low SpO2 ${u.spo2}% (< ${t.spo2Low}%)`, severity: sevLow(u.spo2, t.spo2Low, "spo2") });
  }
  if (t.tempHigh !== undefined && u.temp >= t.tempHigh) {
    const key = `${u.patientId}:temp:high`;
    currentKeys.add(key);
    if (!shouldThrottle(key, now)) items.push({ key, message: `Fever ${u.temp}°C (>= ${t.tempHigh}°C)`, severity: (u.temp >= t.tempHigh + 1 ? "critical" : "warning") });
  }
  if (t.rrHigh !== undefined && u.rr > t.rrHigh) {
    const key = `${u.patientId}:rr:high`;
    currentKeys.add(key);
    if (!shouldThrottle(key, now)) items.push({ key, message: `High RR ${u.rr} (> ${t.rrHigh})`, severity: sevHigh(u.rr, t.rrHigh, "rr") });
  }
  if (t.rrLow !== undefined && u.rr < t.rrLow) {
    const key = `${u.patientId}:rr:low`;
    currentKeys.add(key);
    if (!shouldThrottle(key, now)) items.push({ key, message: `Low RR ${u.rr} (< ${t.rrLow})`, severity: sevLow(u.rr, t.rrLow, "rr") });
  }

  const prev = activeConditions.get(u.patientId) ?? new Set<string>();
  // determine resolved
  const resolved: string[] = [];
  for (const k of prev) {
    if (!currentKeys.has(k)) resolved.push(k);
  }
  // update active set
  activeConditions.set(u.patientId, currentKeys);

  if (items.length) {
    io.to(toRoom(u.patientId)).emit("alert", {
      patientId: u.patientId,
      alerts: items.map(i => i.message), // backward compat
      items,
      timestamp: now
    });
  }
  if (resolved.length) {
    const messages = resolved.map(k => {
      const m = k.split(":" )[1];
      if (m === "hr") return `HR back to ${u.hr}`;
      if (m === "sbp") return `SBP back to ${u.sbp}`;
      if (m === "spo2") return `SpO2 back to ${u.spo2}%`;
      if (m === "temp") return `Temp back to ${u.temp}°C`;
      if (m === "rr") return `RR back to ${u.rr}`;
      return `Recovered: ${k}`;
    });
    io.to(toRoom(u.patientId)).emit("alert_resolved", {
      patientId: u.patientId,
      resolved: messages,
      keys: resolved,
      timestamp: now
    });
  }
}
