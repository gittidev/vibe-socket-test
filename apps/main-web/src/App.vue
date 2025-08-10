<template>
  <div class="wrap">
    <header>
      <div class="logo">Acme Health</div>
      <nav>
        <a href="/" @click.prevent>Home</a>
        <a href="/patient" @click.prevent="open('/patient')">Patient</a>
        <a href="/admin" @click.prevent="open('/admin')">Admin</a>
        <a href="https://github.com/" target="_blank">Docs</a>
      </nav>
    </header>
    <section class="hero">
      <h1>실시간 환자 모니터링 플랫폼</h1>
      <p>Socket 기반 실시간 바이탈 스트리밍과 경보 규칙으로 안전한 의료 운영을 돕습니다.</p>
      <div class="cta">
        <button class="primary" @click="open('/patient')">환자 모니터</button>
        <button class="secondary" @click="open('/admin')">관리자 대시보드</button>
      </div>
    </section>
    <UiGrid class="grid" :cols="3">
      <UiCard>
        <h3>실시간 스트리밍</h3>
        <p>Socket.IO로 환자별 룸 구독과 최신 스냅샷/업데이트/알림을 제공합니다.</p>
      </UiCard>
      <UiCard>
        <h3>경보 규칙</h3>
        <p>기본/병동/환자 단위 임계치와 심각도, 해제 이벤트까지 지원합니다.</p>
      </UiCard>
      <UiCard>
        <h3>확장 가능한 설계</h3>
        <p>모노레포 기반으로 메인/환자/관리자 앱과 공통 패키지를 관리합니다.</p>
      </UiCard>
    </UiGrid>
    <footer>© Acme Health · {{ year }}</footer>
  </div>
</template>

<script setup lang="ts">
const year = new Date().getFullYear();
function open(path: string) { window.location.href = path; }
</script>

<style scoped>
* { box-sizing: border-box }
.wrap { max-width: 1040px; margin: 0 auto; padding: 24px 16px; }
header { display: flex; justify-content: space-between; align-items: center; }
.logo { font-weight: 700; letter-spacing: .4px }
nav a { color: var(--text); text-decoration: none; margin-left: 12px; }
.hero { padding: 48px 0; text-align: center; }
.hero h1 { margin: 0 0 12px; font-size: 32px; }
.hero p { margin: 0 auto 16px; max-width: 680px; color: var(--text); }
.cta { display: flex; gap: 12px; justify-content: center; }
footer { color: var(--text); text-align: center; margin: 16px 0 0; font-size: 12px; }
</style>
