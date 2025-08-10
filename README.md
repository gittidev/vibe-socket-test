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
├─ apps/               # 모노레포 앱들 (api, main-web, patient-web, admin-web)
├─ packages/           # 공통 패키지(shared-types, ui, eslint-config)
├─ package.json        # npm workspaces + 루트 스크립트
└─ tsconfig.base.json  # 공통 TS 설정
```

---

## 빠른 시작(개발 모드)

사전 준비: Node.js 18 이상

모노레포 구조로 앱이 분리되어 있습니다. 루트에서 설치 후 각 앱을 실행하세요.

루트 설치
```
cd C:\\Users\\qhfka\\Desktop\\project\\socket-test
npm install
```

1) API 서버
```
npm run dev -w @apps/api
```
- http://localhost:3000

2) 환자 웹(Patient)
```
npm run dev -w @apps/patient-web
```
- http://localhost:5173 (API/Socket은 프록시)

3) 메인 사이트(Main)
```
npm run dev -w @apps/main-web
```
- http://localhost:5174

4) 관리자 대시보드(Admin)
```
npm run dev -w @apps/admin-web
```
- http://localhost:5175

시뮬레이터가 기본 활성화되어 3초마다 임의 바이탈을 푸시합니다. 수동으로 푸시하려면 아래를 참고하세요.

---

## 프로덕션 빌드/실행

루트에서 모든 앱 빌드
```
npm run build
```
도커 이미지로 통합 실행 시 API가 `/`, `/patient`, `/admin` 경로에 각각 SPA를 서빙합니다.

> 포트 변경: `PORT=4000 npm run dev` (Windows PowerShell: `($env:PORT=4000); npm run dev`)

---

## Docker로 실행

멀티스테이지 Dockerfile이 포함되어 있습니다. (web 빌드 → server 빌드 → 런타임)

빌드
```
docker build -t patient-realtime:local .
```

실행
```
docker run --rm -p 3000:3000 --name patient-realtime patient-realtime:local
```

또는 docker-compose
```
docker compose up --build
```

이미지 구성(모노레포)
- build-main: `apps/main-web` 빌드 → `static/main`
- build-patient: `apps/patient-web` 빌드 → `static/patient`
- build-admin: `apps/admin-web` 빌드 → `static/admin`
- build-api: `apps/api` 빌드 → `dist`

환경 변수
- `PORT`(기본 3000)

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

## 업데이트 요약 (Docker/Dev 구성 변경)

아래 내용은 도커 빌드/실행 및 프런트 라우팅 문제를 해결하며, 현재 리포지토리 상태에 반영되었습니다.

- Dockerfile 정리: 각 SPA(`apps/*-web`)는 자신 워크스페이스만 설치/빌드하고, 올바른 `apps/<app>/dist`를 Nginx 정적 경로로 복사합니다. 루트 `Dockerfile`은 API만 빌드/실행합니다.
- Compose 단순화: `docker-compose.yml`에서 더 이상 `version` 키를 사용하지 않습니다(Compose v2 권장 방식). API의 호스트 포트 매핑은 제거하고, 외부 접근은 Nginx(80) 경유로 일원화했습니다.
- 라우팅: Nginx가 `/` → main, `/patient/` → patient, `/admin/` → admin을 서빙합니다. `/patient`와 `/admin`로 접근 시 각각 `/patient/`, `/admin/`로 리다이렉트됩니다.
- Vite base 설정: `patient`는 `base: '/patient/'`, `admin`은 `base: '/admin/'`로 빌드하여 서브패스 자산 경로 문제를 해결했습니다.
- MIME 타입: SPA 컨테이너용 `nginx.spa.conf`와 리버스 프록시용 `nginx.conf`에 `include /etc/nginx/mime.types;`를 추가해 `.js`가 `application/javascript`로 서빙됩니다.
- Dev 스크립트: 루트 `package.json`에 `concurrently`를 도입해 `API + 3개 웹앱` 동시 실행(`npm run dev`), `웹앱만` 실행(`npm run dev:web`)을 제공합니다. `main-web`은 개발 포트를 `5174`로 지정했습니다.

### API 프록시(CORS/슬래시) 처리

- `/api`로 접근 시 `/api/`로 리다이렉트하여 경로 정규화합니다.
- `/api/` 프록시에는 CORS 헤더를 추가하고, `OPTIONS` 프리플라이트를 204로 처리합니다.
- `/socket.io` 업그레이드 라우트에도 CORS 허용 및 타임아웃/버퍼링 설정을 적용했습니다.

예시(동작 확인)
```
curl -i http://127.0.0.1/api    # 301 → /api/
curl -i http://127.0.0.1/api/   # 200
curl -i -X OPTIONS http://127.0.0.1/api/ -H "Origin: http://127.0.0.1" -H "Access-Control-Request-Method: GET"
```

### 실행 가이드(요약)

- 의존성 설치: `npm install`
- 개발 실행:
  - 전체: `npm run dev` (API 3000, Patient 5173, Main 5174, Admin 5175)
  - 프런트만: `npm run dev:web`
- Docker Compose:
  - 빌드: `docker compose build`
  - 실행: `docker compose up -d`
  - 접속: `http://127.0.0.1/`(main), `/patient/`, `/admin/`

참고(Windows): `localhost`가 IPv6(::1)로 해석되어 접속 문제가 생길 수 있어, 브라우저에서 `127.0.0.1` 사용을 권장합니다.

### 트러블슈팅

- 빈 화면(서브패스): `base` 미설정 시 `/patient`/`/admin` 하위에서 자산을 루트(`/assets`)로 요청합니다. 본문 변경으로 해결(`vite.config.ts`의 `base`).
- MIME 오류(text/plain): Nginx가 `mime.types`를 포함하지 않으면 모듈 스크립트 로딩이 실패합니다. `nginx.spa.conf`/`nginx.conf`에 MIME 설정 추가로 해결.
- 3000 포트 충돌: 호스트 매핑 제거로 해결(Nginx 경유 접속). API 단독 접근이 필요하면 Compose에 일시적으로 `ports: ['3000:3000']`를 추가해 사용하세요.

---

## 운영 배포 권장 설정(요약)

- HTTPS 적용: 리버스 프록시(Nginx)에서 TLS 종단(예: certbot/Let’s Encrypt, 또는 제공된 인증서 사용).
- 정적 자산 최적화: `gzip`/`brotli` 압축, 장기 캐시 헤더(해시 기반 파일에 한함).
- 보안 헤더: `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Content-Security-Policy`(점진적 도입 권장).
- 리소스 제한: Compose/오케스트레이터에서 CPU/메모리 제한 설정, 헬스체크(ready/live) 추가.
- 로그/모니터링: 구조적 로그(JSON) 수집, Nginx/앱 레벨 접속/에러 모니터링.
- 환경 분리: `NODE_ENV=production` 보장, 비밀 값은 환경 변수/시크릿으로 주입.

---

## HTTPS 설정 및 CORS 화이트리스트

이 리포지토리는 Nginx 리버스 프록시에 HTTPS를 추가할 수 있도록 준비되어 있습니다.

구성 포인트
- `docker-compose.yml`의 `nginx` 서비스는 `443:443` 포트를 노출하고, 다음 파일을 마운트합니다.
  - 인증서 디렉터리: `./certs` → `/etc/nginx/certs` (읽기 전용)
  - SSL 서버 설정: `./nginx.ssl.conf` → `/etc/nginx/conf.d/ssl_server.conf`
- `nginx.conf`는 CORS 화이트리스트 맵(`$cors_allow_origin`)을 가지고 있어, `localhost`/`127.0.0.1`만 허용합니다. 운영 도메인을 허용하려면 맵에 정규식을 추가하세요.

1) 인증서 준비(로컬 자가 서명 예시)
```
mkdir -p certs
# OpenSSL로 localhost용 1년짜리 자가 서명 인증서 생성
openssl req -x509 -newkey rsa:2048 -nodes -days 365 \
  -subj "/CN=localhost" \
  -keyout certs/privkey.pem -out certs/fullchain.pem
```
또는 mkcert 사용 권장(신뢰되는 로컬 CA)
```
mkcert -install
mkcert localhost 127.0.0.1 ::1
# 생성된 파일명을 certs 디렉터리로 복사/이동하여 
# fullchain.pem(= .pem) / privkey.pem(= -key.pem)로 맞춰주세요.
```

2) CORS 화이트리스트에 운영 도메인 추가
`nginx.conf` 상단의 `map $http_origin $cors_allow_origin { ... }` 블록에 라인 추가:
```
~^https?://(your\.domain\.com|www\.your\.domain\.com)(:[0-9]{1,5})?$ $http_origin;
```

3) 적용
```
docker compose up -d nginx
docker compose exec -T nginx nginx -t   # 설정 테스트
docker compose exec -T nginx nginx -s reload
```

접속
- HTTP:  http://127.0.0.1/
- HTTPS: https://127.0.0.1/  (브라우저에서 자가 서명 인증서 신뢰 필요)

---

## 개념 가이드: 리버스 프록시 · CORS · 서브패스 · MIME · HTTPS

이 프로젝트에서 변경한 설정들이 왜 필요한지, 핵심 개념을 간단히 정리합니다.

### 1) 리버스 프록시(Nginx) 기본
- 리버스 프록시는 클라이언트 앞단에서 요청을 받아 내부 서비스(업스트림)로 전달합니다.
- 장점: 단일 진입점(도메인/포트 통합), SSL 종료, 캐싱/압축, CORS/보안 헤더 일원화.
- 본 프로젝트 매핑
  - `/` → `main-web` 정적 사이트
  - `/patient/` → `patient-web` 정적 사이트
  - `/admin/` → `admin-web` 정적 사이트
  - `/api/` + `/socket.io` → `api:3000` (Express + Socket.IO)
- Nginx `location`과 `proxy_pass`로 경로별 라우팅을 구성합니다.

### 2) 서브패스(SPA 하위 경로)와 Vite `base`
- SPA를 도메인 루트가 아닌 하위 경로(`/patient/`, `/admin/`)에 올리면, 빌드된 자산 경로도 하위 경로를 기준으로 해야 합니다.
- Vite 설정 `base: '/patient/'` 처럼 지정하면, HTML 내 스크립트/스타일 경로가 `/patient/assets/...`로 생성됩니다.
- 트레일링 슬래시(`/patient` vs `/patient/`)
  - 상대 경로 계산이 달라져 404/빈 화면 원인이 될 수 있습니다.
  - 그래서 `/patient` 요청은 `/patient/`로 301 리다이렉트하도록 설정했습니다.

### 3) MIME 타입과 모듈 스크립트
- 브라우저는 `<script type="module">` 로 불러오는 파일이 반드시 JS MIME(`application/javascript`)이길 요구합니다.
- Nginx가 `mime.types`를 로드하지 않으면 `.js`를 `text/plain`으로 내려줄 수 있어, 모듈 로딩이 실패합니다.
- 해결: `include /etc/nginx/mime.types;`를 추가하고, 기본 타입과 wasm 타입을 보강했습니다.

### 4) CORS(교차 출처 리소스 공유)
- 동작 원리: 브라우저는 스크립트가 다른 출처의 리소스를 호출할 때 SOP를 적용하고, 서버가 내려주는 CORS 헤더를 확인합니다.
- 핵심 헤더
  - `Access-Control-Allow-Origin`: 허용할 출처(도메인). 와일드카드 `*`는 편리하지만 보안상 위험할 수 있습니다.
  - `Access-Control-Allow-Methods`, `-Headers`: 허용 메서드/헤더.
  - `Vary: Origin`: 캐시가 Origin에 따라 응답을 구분하게 함.
  - 프리플라이트: 특정 요청은 사전 `OPTIONS` 요청으로 허용 여부를 확인(204 응답으로 빠르게 종료).
- 본 프로젝트에서는 Nginx `map`으로 화이트리스트를 관리하고, `/api/`, `/socket.io`에만 CORS를 적용했습니다.

테스트 예시
```
curl -i http://127.0.0.1/api/ \
  -H "Origin: http://127.0.0.1" | findstr /R "Access-Control-Allow-Origin Vary"

curl -i -X OPTIONS http://127.0.0.1/api/ \
  -H "Origin: http://127.0.0.1" \
  -H "Access-Control-Request-Method: GET"
```

주의
- 인증 정보를 포함한 CORS(`credentials`)가 필요하면 `Access-Control-Allow-Credentials: true` 및 구체 Origin 지정이 필요합니다. 이때 `*`는 사용할 수 없습니다.

### 5) HTTPS/TLS와 인증서
- HTTPS는 전송 구간을 암호화하여 기밀성과 무결성을 제공합니다.
- 구성 요소
  - 서버 인증서(`fullchain.pem`): 공개키 + 인증서 체인
  - 개인 키(`privkey.pem`): 절대 외부 유출 금지
- 로컬 개발
  - 자가 서명 인증서(OpenSSL) 또는 `mkcert` 권장(로컬에서 신뢰 처리 용이)
  - 브라우저에서 경고가 보이면 신뢰를 수동 승인해야 할 수 있습니다.
- 운영 환경
  - 신뢰된 CA(예: Let’s Encrypt)로 갱신 자동화
  - 강한 TLS 설정(TLS1.2/1.3), 보안 헤더, 압축/캐시 등 부가 설정

추가 학습 키워드
- Nginx: location 매칭 우선순위, `try_files`, `proxy_redirect`, `upstream` 블록
- CORS: 프리플라이트 조건, 단순 요청(Simple Request), Credentials
- 브라우저: SOP(Same-Origin Policy), HSTS, CSP(Content Security Policy)

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

## GitHub Actions(CI/CD)

`.github/workflows/ci.yml`가 포함되어 있습니다.
- build-test 잡: Node 20 설치 → 워크스페이스 일괄 빌드
- docker 잡: GHCR 로그인 → 멀티아키텍처 이미지 빌드/푸시
  - 태그: `ghcr.io/<owner>/<repo>/patient-realtime:latest`, `:<sha>`
  - main/master 브랜치 푸시일 때만 push 활성화

필요 조건
- GitHub Packages 사용을 위해 기본 `GITHUB_TOKEN` 권한으로 충분
- 사설 레지스트리/환경이 필요하면 `DOCKER_USERNAME/DOCKER_PASSWORD` 시크릿으로 교체

배포 파이프라인 팁
- 환경별 워크플로우 분리(qa/prod)
- 쿠버네티스/서버 배포 스텝 추가(예: `kubectl`, `ssh` 등)

---

## NPM Workspaces 기반 모노레포 가이드(개념)

여러 앱(환자 페이지, 메인 사이트, 관리자)과 공유 패키지를 한 저장소에서 관리하려면 NPM Workspaces를 권장합니다.

권장 구조 예시
```
./
├─ apps/
│  ├─ api/            # Express + Socket.IO 백엔드
│  ├─ patient-web/    # 환자 페이지(Vue)
│  ├─ main-web/       # 메인 사이트(예: Next.js/Vue)
│  └─ admin-web/      # 관리자 웹
├─ packages/
│  ├─ shared-types/   # 공통 타입/모델
│  └─ ui/             # 공통 UI 라이브러리
├─ package.json       # workspaces 루트
├─ tsconfig.base.json # 공통 TS 설정(paths 포함)
└─ turbo.json         # (선택) Turborepo 파이프라인
```

루트 `package.json` 예시(개념)
```
{
  "name": "company-monorepo",
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "dev": "npm run dev -w apps/api & npm run dev -w apps/patient-web",
    "build": "npm run build --ws",
    "lint": "npm run lint --ws"
  }
}
```

공유 타입 패키지 예시(개념)
```
// packages/shared-types/package.json
{
  "name": "@shared-types",
  "version": "0.0.0",
  "private": true,
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": { "build": "tsc -p tsconfig.json" }
}
```

이 레포를 바로 모노레포로 전환해드릴 수 있습니다. 원하시면 앱/패키지 폴더 이동과 워크스페이스 설정을 실제로 반영하겠습니다.

---

## 디자인 시스템(@packages/ui)
- 공통 스타일: `packages/ui/styles.css` (다크 테마, 카드/버튼/그리드/테이블 등)
- 컴포넌트: `UiCard`, `UiButton`, `UiBadge`, `UiGrid`, `UiTable`, `UiModal`, `UiTabs`, `UiSpinner`
- 사용법(예):
```
// main.ts
import { createApp } from 'vue';
import App from './App.vue';
import { installUi } from '@packages/ui';
import '@packages/ui/styles.css';
createApp(App).use(installUi).mount('#app');

// SFC
<template>
  <UiCard><UiSpinner /> Loading...</UiCard>
  <UiModal :open="open" @close="open=false">모달 콘텐츠</UiModal>
</template>
```


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

---

## 환경 분리 가이드(간단 요약)

- API(Runtime 환경변수)
  - `PORT`: 서비스 포트(기본 3000)
  - 추후 인증 등을 위해 `API_KEY` 등도 여기에 추가 예정
  - 컨테이너 실행 시 `-e KEY=VALUE` 또는 Compose `environment:`로 주입

- 웹앱(Build-time 환경변수)
  - Vite 규칙상 `VITE_` 접두사 필요(예: `VITE_API_BASE`)
  - 빌드 시 값이 번들에 고정되므로 환경별로 별도 빌드 필요
  - GitHub Environments의 Variables로 `VITE_API_BASE`를 설정하면 워크플로우가 빌드에 주입합니다.

- 예시(.env)
  - `apps/api/.env.example`: `PORT=3000`
  - `apps/*-web/.env.example`: `# VITE_API_BASE=http://api.example.com`

---

## CI/CD 한눈에 이해하기

1) Pull Request
- 하는 일: Lint + Build로 코드 품질 확인(배포 없음)

2) Staging 배포(브랜치: `staging`)
- 하는 일: Docker 이미지 `:staging` 태그로 빌드/푸시 → SSH로 스테이징 서버에서 컨테이너 재실행
- 필요한 것(Secrets in staging Environment): `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_KEY`(SSH), `DEPLOY_PORT(옵션)`
- 선택(Variables in staging Environment): `VITE_API_BASE` (웹앱 빌드 시 API 주소)

3) Production 배포(브랜치: `main` 또는 `master`)
- 하는 일: `:latest` 이미지를 `:prod`로 태깅/푸시 → SSH로 프로덕션 서버에서 컨테이너 재실행
- 필요한 것(Secrets in production Environment): `PROD_DEPLOY_HOST`, `PROD_DEPLOY_USER`, `PROD_DEPLOY_KEY`, `PROD_DEPLOY_PORT(옵션)`
- 선택(Variables in production Environment): `VITE_API_BASE`

서버에서 실제로 실행되는 명령(예)
- 스테이징/프로덕션 공통:

```
docker login ghcr.io -u <github-username> -p <github-token>
docker pull ghcr.io/<owner>/<repo>/patient-realtime:<env-tag>
docker rm -f patient-realtime || true
docker run -d --name patient-realtime --restart unless-stopped -p 3000:3000 ghcr.io/<owner>/<repo>/patient-realtime:<env-tag>
```

TIP
- 방화벽에서 3000 포트 허용
- 도메인 연결 시 리버스 프록시(Nginx/Caddy)로 80/443 → 3000 포워딩
- 환경변수 주입이 필요하면 `docker run ... -e KEY=VALUE` 추가
