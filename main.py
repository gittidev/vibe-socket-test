
import asyncio
import time
import json
from fastapi import FastAPI, WebSocket, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
import redis.asyncio as redis

app = FastAPI()

# CORS 설정 (Vue 개발 서버와 통신하기 위함)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 실제 프로덕션에서는 Vue 앱의 주소만 허용하세요.
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Redis 클라이언트 생성 (비동기)
redis_client = redis.from_url("redis://localhost", decode_responses=True)
REDIS_CHANNEL = "patient_data_channel"

# 백그라운드에서 실행될 실제 데이터 처리 함수
def process_patient_data(patient_id: str):
    """
    환자 데이터를 처리하는 시뮬레이션 함수.
    실제로는 이 함수 안에서 DB 조회, 계산 등 무거운 작업을 수행합니다.
    """
    print(f"[{patient_id}] 데이터 처리 시작...")
    time.sleep(5)  # 5초 동안 작업이 걸린다고 가정
    result = {"patientId": patient_id, "status": "Completed", "data": "Blood Pressure: 120/80"}
    print(f"[{patient_id}] 데이터 처리 완료. Redis에 발행합니다.")

    # 동기 함수 내에서 비동기 Redis 호출을 위해 새로운 이벤트 루프 사용
    asyncio.run(redis_client.publish(REDIS_CHANNEL, json.dumps(result)))

# 1. 프론트엔드에서 작업 시작을 요청할 HTTP 엔드포인트
@app.post("/api/process-patient/{patient_id}")
async def start_processing(patient_id: str, background_tasks: BackgroundTasks):
    """
    데이터 처리를 백그라운드 작업으로 추가하고 즉시 응답을 반환합니다.
    """
    print(f"[{patient_id}] 처리 요청 수신.")
    background_tasks.add_task(process_patient_data, patient_id)
    return {"message": "Patient data processing started.", "patientId": patient_id}

# 2. 프론트엔드와 실시간 통신을 할 WebSocket 엔드포인트
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    pubsub = redis_client.pubsub()
    await pubsub.subscribe(REDIS_CHANNEL)
    print("웹소켓 연결됨. Redis 채널 구독 시작.")
    
    try:
        while True:
            # Redis 채널에서 메시지 확인
            message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
            if message:
                print(f"Redis에서 메시지 수신: {message['data']}")
                # 클라이언트(Vue)에게 메시지 전송
                await websocket.send_text(message['data'])
    except Exception as e:
        print(f"웹소켓 오류: {e}")
    finally:
        await pubsub.unsubscribe(REDIS_CHANNEL)
        print("웹소켓 연결 종료. Redis 채널 구독 해제.")

