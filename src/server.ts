import express from "express";
import http from "http";
import cors from "cors";
import { Server } from "socket.io";
import { listPatients, getLatestVital, setLatestVital } from "./data.js";
import type { VitalUpdate } from "./types.js";
import { startSimulator } from "./simulator.js";
import { getAllRules, setDefaultRules, setWardRules, deleteWardRules, setPatientRules, deletePatientRules, handleAlerts } from "./alerts.js";

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(cors());
app.use(express.json());
// Serve built Vue app first if available, fallback to /public
app.use(express.static("web/dist"));
app.use(express.static("public"));

app.get("/api/patients", (_req, res) => {
  res.json(listPatients());
});

function roomOf(patientId: string) {
  return `patient:${patientId}`;
}

app.post("/api/vitals", (req, res) => {
  const body = req.body as Partial<VitalUpdate>;
  if (!body || !body.patientId) {
    return res.status(400).json({ error: "patientId required" });
  }
  const now = Date.now();
  const u: VitalUpdate = {
    patientId: body.patientId!,
    hr: body.hr ?? 0,
    sbp: body.sbp ?? 0,
    dbp: body.dbp ?? 0,
    spo2: body.spo2 ?? 0,
    temp: body.temp ?? 0,
    rr: body.rr ?? 0,
    timestamp: body.timestamp ?? now
  };
  setLatestVital(u);
  io.to(roomOf(u.patientId)).emit("vital_update", u);
  handleAlerts(io, u);
  res.json({ ok: true });
});

io.on("connection", (socket) => {
  socket.on("join_patient", (patientId: string) => {
    socket.join(roomOf(patientId));
    const latest = getLatestVital(patientId);
    if (latest) {
      socket.emit("patient_snapshot", latest);
    }
  });

  socket.on("leave_patient", (patientId: string) => {
    socket.leave(roomOf(patientId));
  });

  // Optional: 장비가 직접 소켓으로 보낼 경우
  socket.on("push_vitals", (u: VitalUpdate) => {
    setLatestVital(u);
    io.to(roomOf(u.patientId)).emit("vital_update", u);
    handleAlerts(io, u);
  });
});

// 데모용 시뮬레이터(실서비스에서는 제거)
startSimulator(io);

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});

// -------- Alert Rules REST API --------
app.get("/api/alert-rules", (_req, res) => {
  res.json(getAllRules());
});

app.put("/api/alert-rules/default", (req, res) => {
  setDefaultRules(req.body ?? {});
  res.json({ ok: true });
});

app.put("/api/alert-rules/ward/:ward", (req, res) => {
  setWardRules(req.params.ward, req.body ?? {});
  res.json({ ok: true });
});

app.delete("/api/alert-rules/ward/:ward", (req, res) => {
  deleteWardRules(req.params.ward);
  res.json({ ok: true });
});

app.put("/api/alert-rules/patient/:id", (req, res) => {
  setPatientRules(req.params.id, req.body ?? {});
  res.json({ ok: true });
});

app.delete("/api/alert-rules/patient/:id", (req, res) => {
  deletePatientRules(req.params.id);
  res.json({ ok: true });
});
