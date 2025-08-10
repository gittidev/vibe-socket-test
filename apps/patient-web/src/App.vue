<template>
  <div class="container">
    <header>
      <h1>Patient Monitor</h1>
      <a class="link" href="/" target="_self">← 메인으로</a>
    </header>

    <section class="card" style="margin-bottom: 12px">
      <div class="controls">
        <select v-model="selectedId">
          <option v-for="p in patients" :key="p.id" :value="p.id">
            {{ p.id }} - {{ p.name }} ({{ p.ward ?? '' }} {{ p.bed ?? '' }})
          </option>
        </select>
        <button class="primary" @click="openMonitor">추가</button>
        <button class="warn" @click="closeMonitor">닫기</button>
        <button class="secondary" @click="closeAll" :disabled="openIds.length===0">전체닫기</button>
        <span class="text-muted" style="margin-left: 8px">열린 환자: {{ openIds.length }}</span>
      </div>
    </section>

    <section class="grid">
      <div v-for="pid in openIds" :key="pid" class="card">
        <div
          style="
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 4px;
          "
        >
          <h3 style="margin: 0">Vitals · {{ displayName(pid) }}</h3>
          <div style="display: flex; gap: 6px; align-items: center">
            <span class="ui-badge" v-if="patientOf(pid)?.ward"
              >{{ patientOf(pid)?.ward }} {{ patientOf(pid)?.bed ?? '' }}</span
            >
            <button class="small secondary" @click="leave(pid)">닫기</button>
          </div>
        </div>
        <div class="kv">
          <div>HR</div>
          <div class="vital big" :class="clsFor('hr', vitalsBy[pid]?.hr, pid)">{{ vitalsBy[pid]?.hr ?? '-' }}</div>
        </div>
        <div class="kv">
          <div>BP</div>
          <div class="vital big" :class="clsFor('sbp', vitalsBy[pid]?.sbp, pid)">{{ vitalsBy[pid] ? `${vitalsBy[pid].sbp}/${vitalsBy[pid].dbp}` : '-' }}</div>
        </div>
        <div class="kv">
          <div>SpO2</div>
          <div class="vital big" :class="clsFor('spo2', vitalsBy[pid]?.spo2, pid)">{{ vitalsBy[pid] ? `${vitalsBy[pid].spo2}%` : '-' }}</div>
        </div>
        <div class="kv"><div>Temp</div><div class="vital" :class="clsFor('temp', vitalsBy[pid]?.temp, pid)">{{ vitalsBy[pid] ? `${vitalsBy[pid].temp}°C` : '-' }}</div></div>
        <div class="kv"><div>RR</div><div class="vital" :class="clsFor('rr', vitalsBy[pid]?.rr, pid)">{{ vitalsBy[pid]?.rr ?? '-' }}</div></div>
        <div class="kv">
          <div>Updated</div>
          <div class="vital">{{ vitalsBy[pid] ? fmtTs(vitalsBy[pid].timestamp) : '-' }}</div>
        </div>
        <div v-if="(alertsBy[pid]?.length ?? 0) > 0" class="alert pulse">
          <div
            v-for="(a, i) in alertsBy[pid]"
            :key="i"
            :style="{ color: a.severity === 'critical' ? 'var(--danger)' : 'var(--warn)' }"
          >
            ▷ {{ a.message }} ({{ a.severity }})
          </div>
        </div>
        <div v-if="resolvedBy[pid]" class="alert" :style="{ color: 'var(--primary-accent)' }">
          해제: {{ resolvedBy[pid] }}
        </div>
      </div>

      <div class="card" v-if="patients.length">
        <h3 style="margin-top: 0">경보 규칙 관리</h3>
        <div class="kv">
          <div>유효 임계치</div>
          <div style="word-break: break-all">{{ effectiveDisplay }}</div>
        </div>

        <h4>기본(Default)</h4>
        <div class="row" style="gap: 6px; flex-wrap: wrap">
          <template v-for="k in keys" :key="'def-' + k">
            <label>{{ k }}</label>
            <input :placeholder="k" v-model="def[k]" style="width: 80px" />
          </template>
          <button class="primary" @click="saveDefault">저장</button>
        </div>

        <h4>병동(Ward)</h4>
        <div class="row" style="gap: 6px; flex-wrap: wrap">
          <label>Ward</label>
          <select v-model="wardName" style="width: 140px">
            <option value="">- 선택 -</option>
            <option v-for="w in wards" :key="w" :value="w">{{ w }}</option>
          </select>
          <input v-model="wardName" placeholder="직접입력(선택 대신)" style="width: 160px" />
          <template v-for="k in keys" :key="'ward-' + k">
            <label>{{ k }}</label>
            <input :placeholder="k" v-model="ward[k]" style="width: 80px" />
          </template>
          <button class="primary" @click="saveWard">저장</button>
          <button class="danger" @click="clearWard">초기화</button>
        </div>

        <h4>환자(Patient)</h4>
        <div class="row" style="gap: 6px; flex-wrap: wrap">
          <label>patientId</label>
          <input v-model="patId" placeholder="선택 반영" style="width: 110px" />
          <template v-for="k in keys" :key="'pat-' + k">
            <label>{{ k }}</label>
            <input :placeholder="k" v-model="pat[k]" style="width: 80px" />
          </template>
          <button class="primary" @click="savePatient">저장</button>
          <button class="danger" @click="clearPatient">초기화</button>
        </div>
      </div>
    </section>

    <footer>Made with ❤️ Vue 3 + TS</footer>
  </div>
</template>

<script setup lang="ts">
import { io, Socket } from 'socket.io-client';
import { onMounted, ref, watch, computed } from 'vue';
import type {
  Patient,
  VitalUpdate,
  AlertThresholds,
  RulesResponse,
  AlertEvent,
  AlertResolvedEvent,
  AlertItem,
} from './types';

const patients = ref<Patient[]>([]);
const selectedId = ref<string>('');
const openIds = ref<string[]>([]);
const vitalsBy = ref<Record<string, VitalUpdate | null>>({});
const alertsBy = ref<Record<string, AlertItem[]>>({});
const resolvedBy = ref<Record<string, string>>({});
let socket: Socket | null = null;

const rules = ref<RulesResponse | null>(null);
const wardName = ref<string>('');
const patId = ref<string>('');

const keys = [
  'hrHigh',
  'hrLow',
  'sbpHigh',
  'sbpLow',
  'spo2Low',
  'tempHigh',
  'rrHigh',
  'rrLow',
] as const;
type K = (typeof keys)[number];
const def = ref<Record<K, string>>({
  hrHigh: '',
  hrLow: '',
  sbpHigh: '',
  sbpLow: '',
  spo2Low: '',
  tempHigh: '',
  rrHigh: '',
  rrLow: '',
});
const ward = ref<Record<K, string>>({
  hrHigh: '',
  hrLow: '',
  sbpHigh: '',
  sbpLow: '',
  spo2Low: '',
  tempHigh: '',
  rrHigh: '',
  rrLow: '',
});
const pat = ref<Record<K, string>>({
  hrHigh: '',
  hrLow: '',
  sbpHigh: '',
  sbpLow: '',
  spo2Low: '',
  tempHigh: '',
  rrHigh: '',
  rrLow: '',
});

function fmtTs(ms: number) {
  return new Date(ms).toLocaleString();
}

function connectSocket() {
  if (socket) socket.disconnect();
  socket = io('/', { transports: ['websocket'] });
  socket.on('patient_snapshot', (v: VitalUpdate) => {
    vitalsBy.value[v.patientId] = v;
  });
  socket.on('vital_update', (v: VitalUpdate) => {
    vitalsBy.value[v.patientId] = v;
  });
  socket.on('alert', (a: AlertEvent) => {
    const pid = a.patientId;
    if (!pid) return;
    if (a.items && a.items.length) {
      alertsBy.value[pid] = a.items;
    } else if (a.alerts) {
      alertsBy.value[pid] = a.alerts.map((m) => ({
        key: 'legacy',
        message: m,
        severity: 'warning',
      }));
    }
    setTimeout(() => {
      alertsBy.value[pid] = [];
    }, 6000);
  });
  socket.on('alert_resolved', (e: AlertResolvedEvent) => {
    const pid = e.patientId;
    resolvedBy.value[pid] = `${e.resolved.join(', ')} @ ${fmtTs(e.timestamp)}`;
    setTimeout(() => {
      resolvedBy.value[pid] = '';
    }, 4000);
  });
}

function openMonitor() {
  if (!selectedId.value) return;
  if (!openIds.value.includes(selectedId.value)) openIds.value.push(selectedId.value);
  socket?.emit('join_patient', selectedId.value);
  const p = patients.value.find((x) => x.id === selectedId.value);
  wardName.value = p?.ward ?? '';
  patId.value = selectedId.value;
  loadRules();
}
function closeMonitor() {
  if (!selectedId.value) return;
  leave(selectedId.value);
}
function leave(id: string) {
  socket?.emit('leave_patient', id);
  openIds.value = openIds.value.filter((x) => x !== id);
}
function closeAll() {
  if (!openIds.value.length) return;
  for (const id of openIds.value) socket?.emit('leave_patient', id);
  openIds.value = [];
}

async function loadPatients() {
  const res = await fetch('/api/patients');
  patients.value = await res.json();
  if (patients.value.length && !selectedId.value) {
    selectedId.value = patients.value[0].id;
  }
}
async function loadRules() {
  const res = await fetch('/api/alert-rules');
  rules.value = await res.json();
  fill(def.value, rules.value?.default);
  const p = patients.value.find((x) => x.id === selectedId.value);
  if (p?.ward && rules.value?.wards?.[p.ward]) fill(ward.value, rules.value.wards[p.ward]);
  else clear(ward.value);
  if (rules.value?.patients?.[selectedId.value])
    fill(pat.value, rules.value.patients[selectedId.value]);
  else clear(pat.value);
}
function fill(dst: Record<K, string>, t?: AlertThresholds | null) {
  keys.forEach((k) => {
    dst[k] = t && (t as any)[k] != null ? String((t as any)[k]) : '';
  });
}
function clear(dst: Record<K, string>) {
  keys.forEach((k) => (dst[k] = ''));
}
function collect(src: Record<K, string>) {
  const out: Record<string, number> = {};
  keys.forEach((k) => {
    const v = src[k].trim();
    if (v !== '' && !Number.isNaN(Number(v))) (out as any)[k] = Number(v);
  });
  return out;
}
const effective = computed(() => {
  if (!rules.value) return {} as AlertThresholds;
  const p = patients.value.find((x) => x.id === selectedId.value);
  const base = rules.value.default ?? {};
  const w = p?.ward ? (rules.value.wards?.[p.ward] ?? {}) : {};
  const pt = rules.value.patients?.[selectedId.value] ?? {};
  return Object.assign({}, base, w, pt);
});
const effectiveDisplay = computed(() => JSON.stringify(effective.value));
async function saveDefault() {
  const body = collect(def.value);
  await fetch('/api/alert-rules/default', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  await loadRules();
}
async function saveWard() {
  if (!wardName.value.trim()) {
    alert('Ward를 입력하세요');
    return;
  }
  const body = collect(ward.value);
  await fetch(`/api/alert-rules/ward/${encodeURIComponent(wardName.value.trim())}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  await loadRules();
}
async function clearWard() {
  if (!wardName.value.trim()) {
    alert('Ward를 입력하세요');
    return;
  }
  await fetch(`/api/alert-rules/ward/${encodeURIComponent(wardName.value.trim())}`, {
    method: 'DELETE',
  });
  await loadRules();
}
async function savePatient() {
  if (!patId.value.trim()) {
    alert('patientId를 입력하세요');
    return;
  }
  const body = collect(pat.value);
  await fetch(`/api/alert-rules/patient/${encodeURIComponent(patId.value.trim())}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  await loadRules();
}
async function clearPatient() {
  if (!patId.value.trim()) {
    alert('patientId를 입력하세요');
    return;
  }
  await fetch(`/api/alert-rules/patient/${encodeURIComponent(patId.value.trim())}`, {
    method: 'DELETE',
  });
  await loadRules();
}

onMounted(async () => {
  connectSocket();
  await loadPatients();
  await loadRules();
});
const wards = computed<string[]>(() =>
  Array.from(new Set(patients.value.map((p) => p.ward).filter(Boolean) as string[]))
);
watch(selectedId, () => {
  /* selection affects rules pane only */
});
function effectiveFor(id: string): AlertThresholds {
  if (!rules.value) return {} as AlertThresholds;
  const p = patients.value.find((x) => x.id === id);
  const base = rules.value.default ?? {};
  const w = p?.ward ? (rules.value.wards?.[p.ward] ?? {}) : {};
  const pt = rules.value.patients?.[id] ?? {};
  return Object.assign({}, base, w, pt);
}
function clsFor(metric: 'hr'|'sbp'|'spo2'|'temp'|'rr', value?: number, id?: string) {
  if (value == null) return '';
  const eff = (id ? effectiveFor(id) : effective.value) as any;
  const warn = 'text-warn';
  const danger = 'text-danger';
  if (metric === 'hr') {
    if (eff.hrHigh != null && value > eff.hrHigh * 1.15) return danger;
    if (eff.hrHigh != null && value > eff.hrHigh) return warn;
    if (eff.hrLow  != null && value < eff.hrLow * 0.85) return danger;
    if (eff.hrLow  != null && value < eff.hrLow) return warn;
  }
  if (metric === 'sbp') {
    if (eff.sbpHigh != null && value > eff.sbpHigh * 1.15) return danger;
    if (eff.sbpHigh != null && value > eff.sbpHigh) return warn;
    if (eff.sbpLow  != null && value < eff.sbpLow * 0.85) return danger;
    if (eff.sbpLow  != null && value < eff.sbpLow) return warn;
  }
  if (metric === 'spo2') {
    if (eff.spo2Low != null && value < eff.spo2Low - 2) return danger;
    if (eff.spo2Low != null && value < eff.spo2Low) return warn;
  }
  if (metric === 'temp') {
    if (eff.tempHigh != null && value >= eff.tempHigh + 1.0) return danger;
    if (eff.tempHigh != null && value >= eff.tempHigh) return warn;
  }
  if (metric === 'rr') {
    if (eff.rrHigh != null && value > eff.rrHigh * 1.15) return danger;
    if (eff.rrHigh != null && value > eff.rrHigh) return warn;
    if (eff.rrLow  != null && value < eff.rrLow * 0.85) return danger;
    if (eff.rrLow  != null && value < eff.rrLow) return warn;
  }
  return '';
}

function displayName(id: string) {
  const p = patients.value.find((x) => x.id === id);
  return p ? `${p.id} - ${p.name}` : id;
}
function patientOf(id: string) {
  return patients.value.find((x) => x.id === id);
}
</script>

<style scoped>
.container {
  max-width: 980px;
  margin: 32px auto;
  padding: 0 16px;
}
header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}
h1 {
  font-size: 22px;
  letter-spacing: 0.3px;
  margin: 0;
}
.link {
  color: var(--text);
  text-decoration: none;
}
.row {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}
.controls {
  display: grid;
  grid-template-columns: 1fr auto auto auto auto;
  gap: 8px;
  align-items: center;
}
select,
input {
  background: var(--secondary-accent);
  color: var(--text);
  border: 1px solid var(--card-border);
  border-radius: 8px;
  padding: 8px 10px;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 16px;
}
.kv {
  display: grid;
  grid-template-columns: 120px 1fr;
  gap: 8px;
  margin: 4px 0;
}
.vital {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
.vital.big { font-size: 22px; font-weight: 700; }
.alert {
  font-weight: 600;
  margin-top: 8px;
}
.alert.pulse { animation: pulse-bg 1.6s ease-in-out infinite; }
@keyframes pulse-bg {
  0% { box-shadow: 0 0 0 0 rgba(245, 158, 11, .20); }
  70% { box-shadow: 0 0 0 10px rgba(245, 158, 11, 0); }
  100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0); }
}
footer {
  margin-top: 24px;
  color: var(--text);
  font-size: 12px;
  text-align: center;
}
@media (max-width: 720px) {
  .grid {
    grid-template-columns: 1fr;
  }
}
</style>
