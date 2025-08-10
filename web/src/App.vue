<template>
  <div class="container">
    <header>
      <h1>Patient Monitor</h1>
      <span class="badge">Vue 3 · TypeScript · Socket.IO</span>
    </header>

    <section class="card" style="margin-bottom:12px;">
      <div class="controls">
        <select v-model="selectedId">
          <option v-for="p in patients" :key="p.id" :value="p.id">
            {{ p.id }} - {{ p.name }} ({{ p.ward ?? '' }} {{ p.bed ?? '' }})
          </option>
        </select>
        <button class="primary" @click="subscribe">구독</button>
        <button class="danger" @click="unsubscribe">해제</button>
      </div>
    </section>

    <section class="grid">
      <div class="card">
        <h3 style="margin-top:0">Vitals</h3>
        <div class="kv"><div>HR</div><div class="vital" :style="colorFor('hr', vitals?.hr)">{{ vitals?.hr ?? '-' }}</div></div>
        <div class="kv"><div>BP</div><div class="vital" :style="colorFor('sbp', vitals?.sbp)">{{ vitals ? `${vitals.sbp}/${vitals.dbp}` : '-' }}</div></div>
        <div class="kv"><div>SpO2</div><div class="vital" :style="colorFor('spo2', vitals?.spo2)">{{ vitals ? `${vitals.spo2}%` : '-' }}</div></div>
        <div class="kv"><div>Temp</div><div class="vital" :style="colorFor('temp', vitals?.temp)">{{ vitals ? `${vitals.temp}°C` : '-' }}</div></div>
        <div class="kv"><div>RR</div><div class="vital" :style="colorFor('rr', vitals?.rr)">{{ vitals?.rr ?? '-' }}</div></div>
        <div class="kv"><div>Updated</div><div class="vital">{{ vitals ? fmtTs(vitals.timestamp) : '-' }}</div></div>
        <div v-if="alertItems.length" class="alert">
          <div v-for="(a, i) in alertItems" :key="i" :style="{color: a.severity==='critical' ? '#ef4444':'#f59e0b'}">
            ▷ {{ a.message }} ({{ a.severity }})
          </div>
        </div>
        <div v-if="resolvedText" class="alert" style="color:#22c55e;">해제: {{ resolvedText }}</div>
      </div>

      <div class="card">
        <h3 style="margin-top:0">경보 규칙 관리</h3>
        <div class="kv"><div>유효 임계치</div><div style="word-break:break-all">{{ effectiveDisplay }}</div></div>

        <h4>기본(Default)</h4>
        <div class="row" style="gap:6px; flex-wrap:wrap">
          <template v-for="k in keys" :key="'def-'+k">
            <label>{{ k }}</label>
            <input :placeholder="k" v-model="def[k]" style="width:80px" />
          </template>
          <button class="primary" @click="saveDefault">저장</button>
        </div>

        <h4>병동(Ward)</h4>
        <div class="row" style="gap:6px; flex-wrap:wrap">
          <label>Ward</label>
          <select v-model="wardName" style="width:140px">
            <option value="">- 선택 -</option>
            <option v-for="w in wards" :key="w" :value="w">{{ w }}</option>
          </select>
          <input v-model="wardName" placeholder="직접입력(선택 대신)" style="width:160px"/>
          <template v-for="k in keys" :key="'ward-'+k">
            <label>{{ k }}</label>
            <input :placeholder="k" v-model="ward[k]" style="width:80px" />
          </template>
          <button class="primary" @click="saveWard">저장</button>
          <button class="danger" @click="clearWard">초기화</button>
        </div>

        <h4>환자(Patient)</h4>
        <div class="row" style="gap:6px; flex-wrap:wrap">
          <label>patientId</label>
          <input v-model="patId" placeholder="선택 반영" style="width:110px"/>
          <template v-for="k in keys" :key="'pat-'+k">
            <label>{{ k }}</label>
            <input :placeholder="k" v-model="pat[k]" style="width:80px" />
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
import type { Patient, VitalUpdate, AlertThresholds, RulesResponse, AlertEvent, AlertResolvedEvent, AlertItem } from './types';

const patients = ref<Patient[]>([]);
const selectedId = ref<string>('');
const vitals = ref<VitalUpdate | null>(null);
const alertItems = ref<AlertItem[]>([]);
const resolvedText = ref<string>('');
let socket: Socket | null = null;

const rules = ref<RulesResponse | null>(null);
const wardName = ref<string>('');
const patId = ref<string>('');

const keys = ['hrHigh','hrLow','sbpHigh','sbpLow','spo2Low','tempHigh','rrHigh','rrLow'] as const;
type K = typeof keys[number];
const def = ref<Record<K, string>>({ hrHigh:'',hrLow:'',sbpHigh:'',sbpLow:'',spo2Low:'',tempHigh:'',rrHigh:'',rrLow:'' });
const ward = ref<Record<K, string>>({ hrHigh:'',hrLow:'',sbpHigh:'',sbpLow:'',spo2Low:'',tempHigh:'',rrHigh:'',rrLow:'' });
const pat = ref<Record<K, string>>({ hrHigh:'',hrLow:'',sbpHigh:'',sbpLow:'',spo2Low:'',tempHigh:'',rrHigh:'',rrLow:'' });

function fmtTs(ms: number) { return new Date(ms).toLocaleString(); }

function connectSocket() {
  if (socket) socket.disconnect();
  // Explicitly point to backend in dev; vite proxy handles /socket.io
  socket = io('/', { transports: ['websocket'] });
  socket.on('patient_snapshot', (v: VitalUpdate) => { vitals.value = v; });
  socket.on('vital_update', (v: VitalUpdate) => { vitals.value = v; });
  socket.on('alert', (a: AlertEvent) => {
    if (a.items && a.items.length) {
      alertItems.value = a.items;
    } else if (a.alerts) {
      alertItems.value = a.alerts.map(m => ({ key: 'legacy', message: m, severity: 'warning' }));
    }
    setTimeout(() => alertItems.value = [], 6000);
  });
  socket.on('alert_resolved', (e: AlertResolvedEvent) => {
    resolvedText.value = `${e.resolved.join(', ')} @ ${fmtTs(e.timestamp)}`;
    setTimeout(() => resolvedText.value = '', 4000);
  });
}

function subscribe() {
  if (!selectedId.value) return;
  socket?.emit('join_patient', selectedId.value);
  const p = patients.value.find(x => x.id === selectedId.value);
  wardName.value = p?.ward ?? '';
  patId.value = selectedId.value;
  loadRules();
}
function unsubscribe() {
  if (!selectedId.value) return;
  socket?.emit('leave_patient', selectedId.value);
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
  // fill inputs
  fill(def.value, rules.value?.default);
  const p = patients.value.find(x => x.id === selectedId.value);
  if (p?.ward && rules.value?.wards?.[p.ward]) fill(ward.value, rules.value.wards[p.ward]); else clear(ward.value);
  if (rules.value?.patients?.[selectedId.value]) fill(pat.value, rules.value.patients[selectedId.value]); else clear(pat.value);
}

function fill(dst: Record<K,string>, t?: AlertThresholds | null) {
  keys.forEach(k => { dst[k] = (t && (t as any)[k] != null) ? String((t as any)[k]) : '' });
}
function clear(dst: Record<K,string>) { keys.forEach(k => dst[k] = ''); }

function collect(src: Record<K,string>) {
  const out: Record<string, number> = {};
  keys.forEach(k => { const v = src[k].trim(); if (v !== '' && !Number.isNaN(Number(v))) (out as any)[k] = Number(v); });
  return out;
}

const effective = computed(() => {
  if (!rules.value) return {} as AlertThresholds;
  const p = patients.value.find(x => x.id === selectedId.value);
  const base = rules.value.default ?? {};
  const w = p?.ward ? (rules.value.wards?.[p.ward] ?? {}) : {};
  const pt = (rules.value.patients?.[selectedId.value]) ?? {};
  return Object.assign({}, base, w, pt);
});
const effectiveDisplay = computed(() => JSON.stringify(effective.value));

async function saveDefault() {
  const body = collect(def.value);
  await fetch('/api/alert-rules/default', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  await loadRules();
}
async function saveWard() {
  if (!wardName.value.trim()) { alert('Ward를 입력하세요'); return; }
  const body = collect(ward.value);
  await fetch(`/api/alert-rules/ward/${encodeURIComponent(wardName.value.trim())}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  await loadRules();
}
async function clearWard() {
  if (!wardName.value.trim()) { alert('Ward를 입력하세요'); return; }
  await fetch(`/api/alert-rules/ward/${encodeURIComponent(wardName.value.trim())}`, { method: 'DELETE' });
  await loadRules();
}
async function savePatient() {
  if (!patId.value.trim()) { alert('patientId를 입력하세요'); return; }
  const body = collect(pat.value);
  await fetch(`/api/alert-rules/patient/${encodeURIComponent(patId.value.trim())}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  await loadRules();
}
async function clearPatient() {
  if (!patId.value.trim()) { alert('patientId를 입력하세요'); return; }
  await fetch(`/api/alert-rules/patient/${encodeURIComponent(patId.value.trim())}`, { method: 'DELETE' });
  await loadRules();
}

onMounted(async () => {
  connectSocket();
  await loadPatients();
  await loadRules();
});

const wards = computed<string[]>(() => Array.from(new Set(patients.value.map(p => p.ward).filter(Boolean) as string[])));

watch(selectedId, () => { vitals.value = null; alertItems.value = []; resolvedText.value = ''; });

function colorFor(metric: 'hr'|'sbp'|'spo2'|'temp'|'rr', value?: number) {
  if (value == null) return {} as any;
  const eff = effective.value as any;
  if (metric === 'hr') {
    if (eff.hrHigh != null && value > eff.hrHigh) return { color: '#f59e0b' };
    if (eff.hrLow != null && value < eff.hrLow) return { color: '#f59e0b' };
  }
  if (metric === 'sbp') {
    if (eff.sbpHigh != null && value > eff.sbpHigh) return { color: '#f59e0b' };
    if (eff.sbpLow != null && value < eff.sbpLow) return { color: '#f59e0b' };
  }
  if (metric === 'spo2') {
    if (eff.spo2Low != null && value < eff.spo2Low) return { color: '#f59e0b' };
  }
  if (metric === 'temp') {
    if (eff.tempHigh != null && value >= eff.tempHigh) return { color: '#f59e0b' };
  }
  if (metric === 'rr') {
    if (eff.rrHigh != null && value > eff.rrHigh) return { color: '#f59e0b' };
    if (eff.rrLow != null && value < eff.rrLow) return { color: '#f59e0b' };
  }
  return { color: '#e5e7eb' };
}
</script>

<style scoped>
h3, h4 { margin: 8px 0; }
</style>
