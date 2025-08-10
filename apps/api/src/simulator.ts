import type { Server } from "socket.io";
import { listPatients, setLatestVital } from "./data.js";
import type { VitalUpdate } from "./types.js";
import { handleAlerts } from "./alerts.js";

function randomIn(min: number, max: number) { return Math.round(min + Math.random() * (max - min)); }
function makeUpdate(patientId: string): VitalUpdate {
  const now = Date.now();
  const hr = randomIn(55, 130);
  const sbp = randomIn(90, 180);
  const dbp = randomIn(50, 100);
  const spo2 = randomIn(88, 99);
  const temp = Math.round((36 + Math.random() * 3) * 10) / 10;
  const rr = randomIn(10, 28);
  return { patientId, hr, sbp, dbp, spo2, temp, rr, timestamp: now };
}
function toRoom(patientId: string) { return `patient:${patientId}`; }

export function startSimulator(io: Server) {
  setInterval(() => {
    for (const p of listPatients()) {
      const u = makeUpdate(p.id);
      setLatestVital(u);
      io.to(toRoom(p.id)).emit("vital_update", u);
      handleAlerts(io, u);
    }
  }, 3000);
}

