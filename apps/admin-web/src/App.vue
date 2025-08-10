<template>
  <div class="wrap">
    <header>
      <div class="logo">Admin Dashboard</div>
      <a class="link" href="/" target="_self">← 메인</a>
    </header>
    <section class="grid">
      <UiCard>
        <h3>환자 목록</h3>
        <table>
          <thead>
            <tr><th>ID</th><th>이름</th><th>병동</th><th>침상</th><th>구독</th></tr>
          </thead>
          <tbody>
            <tr v-for="p in patients" :key="p.id">
              <td>{{ p.id }}</td>
              <td>{{ p.name }}</td>
              <td>{{ p.ward }}</td>
              <td>{{ p.bed }}</td>
              <td>
                <button @click="join(p.id)" class="small">Join</button>
                <button @click="leave(p.id)" class="small warn">Leave</button>
              </td>
            </tr>
          </tbody>
        </table>
      </UiCard>
      <UiCard>
        <h3>알림 로그</h3>
        <div class="alerts">
          <div v-for="(a,i) in alerts" :key="i" :class="['item', a.type]">
            <div class="ts">{{ fmtTs(a.ts) }}</div>
            <div class="msg">{{ a.msg }}</div>
          </div>
        </div>
      </UiCard>
    </section>
  </div>
</template>

<script setup lang="ts">
import { io, Socket } from 'socket.io-client';
import { onMounted, ref } from 'vue';
type Patient = { id: string; name: string; ward?: string; bed?: string };
type AlertItem = { message: string; severity: 'warning'|'critical' };
type AlertEvent = { items?: AlertItem[]; alerts?: string[]; timestamp: number };
type AlertResolvedEvent = { resolved: string[]; timestamp: number };

const patients = ref<Patient[]>([]);
const alerts = ref<{ ts: number; msg: string; type: 'warn'|'crit'|'ok' }[]>([]);
let socket: Socket | null = null;
function fmtTs(ms: number) { return new Date(ms).toLocaleTimeString(); }

function join(id: string) { socket?.emit('join_patient', id); }
function leave(id: string) { socket?.emit('leave_patient', id); }

onMounted(async () => {
  const res = await fetch('/api/patients');
  patients.value = await res.json();
  socket = io('/', { transports: ['websocket'] });
  socket.on('alert', (e: AlertEvent) => {
    if (e.items && e.items.length) {
      for (const it of e.items) alerts.value.unshift({ ts: e.timestamp, msg: it.message, type: it.severity === 'critical' ? 'crit' : 'warn' });
    } else if (e.alerts) {
      for (const m of e.alerts) alerts.value.unshift({ ts: e.timestamp, msg: m, type: 'warn' });
    }
    alerts.value = alerts.value.slice(0, 100);
  });
  socket.on('alert_resolved', (e: AlertResolvedEvent) => {
    for (const m of e.resolved) alerts.value.unshift({ ts: e.timestamp, msg: m, type: 'ok' });
    alerts.value = alerts.value.slice(0, 100);
  });
});
</script>

<style scoped>
header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.link { color: var(--text); text-decoration: none; }
.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.alerts { max-height: 420px; overflow: auto; display: grid; gap: 8px; }
.item { display: grid; grid-template-columns: 90px 1fr; gap: 8px; padding: 8px; border-radius: 8px; border: 1px solid var(--card-border); }
.item.warn { background: rgba(245, 158, 11, .08); }
.item.crit { background: rgba(239, 68, 68, .08); }
.item.ok { background: rgba(34, 197, 94, .08); }
.ts { color: var(--text); font-size: 12px; }
</style>
