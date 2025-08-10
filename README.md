# Patient Realtime Monitor (Socket + REST + Vue)

실시간(WebSocket)으로 환자 바이탈 정보를 구독/표시하고, 경보(알림) 규칙을 설정할 수 있는 데모 프로젝트입니다.

- 백엔드: Node.js, Express, Socket.IO, TypeScript
- 프런트엔드: Vue 3 + TypeScript + Vite (다크 테마 간단 UI)
- 기능: 환자별 룸 구독, 실시간 바이탈 업데이트, 경보 심각도/해제 이벤트, 규칙 관리(기본/병동/환자)

> 참고: 데모/학습 목적용입니다. 실제 PHI/의료 데이터 운영 환경에는 인증, 권한, 감사로그, 보안, 데이터 영속화와 규정 준수(예: HIPAA/ISMS)가 필요합니다.

---

## 폴더 구조

```
./
├─ src/                # 백엔드(Express + Socket.IO)
│  ├─ server.ts        # 서버 엔트리, REST + Socket 라우팅
│  ├─ data.ts          # 인메모리 환자 목록/최신 바이탈 저장소
│  ├─ alerts.ts        # 경보 규칙/스로틀/해제 로직
│  └─ simulator.ts     # 데모용 바이탈 시뮬레이터 (3초 간격)
├─ public/             # (옵션) 정적 데모 클라이언트(기본 불필요)
├─ web/                # 프런트(Vue 3 + TS + Vite)
│  ├─ src/App.vue      # UI(바이탈, 경보, 규칙 관리)
│  └─ ...
├─ package.json        # 백엔드 빌드/실행 스크립트
└─ tsconfig.json
```

---

## 빠른 시작(개발 모드)

사전 준비: Node.js 18 이상

1) 백엔드 실행

- 터미널 1
```
cd C:\\Users\\qhfka\\Desktop\\project\\socket-test
npm install
npm run dev
```
- 서버: http://localhost:3000

2) 프런트엔드 실행 (Vite dev server)

- 터미널 2
```
cd C:\\Users\\qhfka\\Desktop\\project\\socket-test\\web
npm install
npm run dev
```
- 브라우저: http://localhost:5173
- 개발 프록시가 `/api`, `/socket.io`를 `http://localhost:3000`으로 연결합니다.

시뮬레이터가 기본 활성화되어 3초마다 임의 바이탈을 푸시합니다. 수동으로 푸시하려면 아래를 참고하세요.

---

## 프로덕션 빌드/실행

1) 프런트 빌드
```
cd web
npm run build
```
→ 산출물: `web/dist`

2) 백엔드 빌드/실행
```
cd ..
npm run build
npm start
```
- 서버가 `web/dist`를 정적으로 서빙합니다: http://localhost:3000

> 포트 변경: `PORT=4000 npm run dev` (Windows PowerShell: `($env:PORT=4000); npm run dev`)

---

## API

### GET /api/patients
- 환자 목록 반환
- 응답 예시
```
[
  {"id":"p001","name":"Kim, Jiwoo","ward":"ICU","bed":"1A"},
  {"id":"p002","name":"Park, Minseo","ward":"ICU","bed":"1B"}
]
```

### POST /api/vitals
- 장비/서비스가 최신 바이탈을 푸시
- 요청 JSON 예시
```
{
  "patientId": "p001",
  "hr": 132, "sbp": 185, "dbp": 95,
  "spo2": 88, "temp": 38.6, "rr": 24,
  "timestamp": 1717730000000   // (옵션) epoch ms, 없으면 서버가 채움
}
```
- 효과: 최신값 저장 + 해당 환자 룸으로 `vital_update` 브로드캐스트 + 규칙 평가 후 `alert`/`alert_resolved`

### 경보 규칙(임계치) API
- 병합 규칙: 기본(default) → 병동(ward) → 환자(patient) 순으로 오버라이드
- 임계치 필드: `hrHigh, hrLow, sbpHigh, sbpLow, spo2Low, tempHigh, rrHigh, rrLow`

1) GET /api/alert-rules
```
{
  "default": {"hrHigh":120, ...},
  "wards": {"ICU": {"tempHigh": 38.0}},
  "patients": {"p001": {"hrHigh": 140}}
}
```

2) PUT /api/alert-rules/default
- 바디에 포함된 필드만 갱신
```
{"hrHigh":130,"spo2Low":92}
```

3) PUT /api/alert-rules/ward/:ward
- 해당 병동 임계치 오버라이드 저장/병합
```
{"sbpHigh":170,"tempHigh":38.0}
```

4) DELETE /api/alert-rules/ward/:ward
- 해당 병동 오버라이드 제거

5) PUT /api/alert-rules/patient/:id
- 특정 환자 임계치 오버라이드 저장/병합

6) DELETE /api/alert-rules/patient/:id
- 특정 환자 오버라이드 제거

---

## WebSocket(실시간)

- 네임스페이스: 기본(`/`)
- 룸: `patient:{id}`

클라이언트 → 서버 이벤트
- `join_patient` (string patientId): 룸 참가 + 최신 스냅샷 `patient_snapshot` 수신
- `leave_patient` (string patientId): 룸 탈퇴
- `push_vitals` (VitalUpdate): 장비가 소켓으로 직접 푸시(옵션, 데모용)

서버 → 클라이언트 이벤트
- `patient_snapshot` (VitalUpdate): 구독 직후 최신 스냅샷
- `vital_update` (VitalUpdate): 새 바이탈 발생 시
- `alert` (AlertEvent): 규칙 위반 경보
```
// AlertEvent
{
  "patientId":"p001",
  "timestamp":1717730000000,
  // 하위호환 문자열 배열
  "alerts":["High HR 140 (> 120)"],
  // 신규 상세 항목(있을 경우 우선 사용)
  "items":[
    {"key":"p001:hr:high", "message":"High HR 140 (> 120)", "severity":"critical"}
  ]
}
```
- `alert_resolved` (AlertResolvedEvent): 정상 범위 복귀 알림
```
{
  "patientId":"p001",
  "timestamp":1717730300000,
  "resolved":["HR back to 98"],
  "keys":["p001:hr:high"]
}
```

### 심각도(Severity) 기준(기본 로직)
- HR/SBP/RR: 임계치의 15% 초과 → `critical`, 그 미만 초과 → `warning`
- SpO2: 임계치보다 2% 추가 하락 → `critical`, 그 미만 → `warning`
- Temp: 임계치보다 1.0°C 이상 ↑ → `critical`, 그 미만 ↑ → `warning`

> 이 로직은 `src/alerts.ts`에서 조정할 수 있습니다.

---

## 프런트엔드(Vue) 기능
- 환자 선택/구독, 실시간 바이탈 렌더링
- 임계치 초과/미만 수치 강조(색상)
- 경보 표시: 심각도별 색상(critical=red, warning=amber)
- 해제(alert_resolved) 반영
- 규칙 관리 UI: 기본/병동/환자 임계치 설정 및 초기화, 현재 선택 환자의 유효 임계치 표시

개발 모드에서 Vite(5173)로 접속하거나, 프로덕션 빌드 후 백엔드(3000)에서 통합 서빙합니다.

---

## 시뮬레이터
- 위치: `src/simulator.ts`
- 설명: 데모용으로 3초마다 무작위 값 생성 → 최신값 저장 → 룸으로 `vital_update` + `alert`/`alert_resolved`
- 비활성화: `src/server.ts`의 `startSimulator(io);` 라인을 주석 처리하세요.

---

## 트러블슈팅
- Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'express'
  - 설치 전 실행했을 가능성 → 루트에서 `npm install` 후 `npm run dev`
- 포트 충돌
  - 백엔드: `PORT` 환경변수로 변경 (예: PowerShell `($env:PORT=4000); npm run dev`)
  - 프런트: `web/vite.config.ts`의 `server.port` 수정(기본 5173)
- 네트워크/프록시 문제로 `npm install` 실패
  - `npm config set registry https://registry.npmjs.org/`
  - 사내 프록시 사용 시 HTTPS_PROXY/HTTP_PROXY 설정 필요

---

## 다음 단계(확장 아이디어)
- 인증/JWT, 역할 기반 접근 제어(RBAC)
- 데이터 영속화(PostgreSQL/Redis) + 히스토리 API + 차트
- 병동 단위 브로드캐스트(`ward:{name}` 룸)
- 경보 규칙 스키마 검증(Zod/Joi), UI 폼 검증
- 경보 히스토리/타임라인, 브라우저 알림/사운드

---

## 스크립트(루트)
- 개발 실행: `npm run dev`
- 빌드: `npm run build`
- 프로덕션 실행: `npm start`

## 스크립트(web)
- 개발 실행: `npm run dev`
- 빌드: `npm run build`
- 프리뷰: `npm run preview`

---

## 샘플 요청
- PowerShell
```
Invoke-RestMethod -Uri http://localhost:3000/api/vitals -Method Post -ContentType 'application/json' -Body '{"patientId":"p001","hr":132,"sbp":185,"dbp":95,"spo2":88,"temp":38.6,"rr":24}'
```
- curl
```
curl -X POST http://localhost:3000/api/vitals \
  -H "Content-Type: application/json" \
  -d '{"patientId":"p001","hr":132,"sbp":185,"dbp":95,"spo2":88,"temp":38.6,"rr":24}'
```

---

문의나 추가 기능 요청(인증/DB/알림 UI 강화 등)은 이슈로 남겨주세요.
