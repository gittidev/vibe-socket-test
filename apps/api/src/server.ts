import express from "express";
import http from "http";
import cors from "cors";
import { Server } from "socket.io";
import { listPatients, getLatestVital, setLatestVital } from "./data.js";
import type { VitalUpdate } from "@packages/shared-types";
import { startSimulator } from "./simulator.js";
import { getAllRules, setDefaultRules, setWardRules, deleteWardRules, setPatientRules, deletePatientRules, handleAlerts } from "./alerts.js";
import path from "path";
import { existsSync } from "fs";

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(cors());
app.use(express.json());

// Serve built SPAs if present (Docker runtime copies to ./static/...)
const staticRoot = path.resolve(process.cwd(), "static");
const staticSites = [
  { url: "/", dir: path.join(staticRoot, "main") },
  { url: "/patient", dir: path.join(staticRoot, "patient") },
  { url: "/admin", dir: path.join(staticRoot, "admin") }
];
for (const s of staticSites) {
  if (existsSync(s.dir)) {
    app.use(s.url, express.static(s.dir));
    // SPA fallback
    app.get([s.url, `${s.url}/*`], (_req, res, next) => {
      if (!existsSync(path.join(s.dir, "index.html"))) return next();
      res.sendFile(path.join(s.dir, "index.html"));
    });
  }
}

app.get("/api/patients", (_req, res) => { res.json(listPatients()); });

function roomOf(patientId: string) { return `patient:${patientId}`; }

app.post("/api/vitals", (req, res) => {
  const body = req.body as Partial<VitalUpdate>;
  if (!body || !body.patientId) { return res.status(400).json({ error: "patientId required" }); }
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
    if (latest) { socket.emit("patient_snapshot", latest); }
  });
  socket.on("leave_patient", (patientId: string) => { socket.leave(roomOf(patientId)); });
  socket.on("push_vitals", (u: VitalUpdate) => {
    setLatestVital(u);
    io.to(roomOf(u.patientId)).emit("vital_update", u);
    handleAlerts(io, u);
  });
});

// Alert rules REST
app.get("/api/alert-rules", (_req, res) => { res.json(getAllRules()); });
app.put("/api/alert-rules/default", (req, res) => { setDefaultRules(req.body ?? {}); res.json({ ok: true }); });
app.put("/api/alert-rules/ward/:ward", (req, res) => { setWardRules(req.params.ward, req.body ?? {}); res.json({ ok: true }); });
app.delete("/api/alert-rules/ward/:ward", (req, res) => { deleteWardRules(req.params.ward); res.json({ ok: true }); });
app.put("/api/alert-rules/patient/:id", (req, res) => { setPatientRules(req.params.id, req.body ?? {}); res.json({ ok: true }); });
app.delete("/api/alert-rules/patient/:id", (req, res) => { deletePatientRules(req.params.id); res.json({ ok: true }); });

// Demo simulator
startSimulator(io);

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
server.listen(PORT, () => { console.log(`API listening on http://localhost:${PORT}`); });
