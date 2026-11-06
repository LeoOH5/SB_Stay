import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.core.errors import http_exception_handler, validation_exception_handler
from app.jobs import auto_refund
from app.routers import (
    admin,
    ai,
    auth,
    bookings,
    buddies,
    buddy_me,
    contents,
    dorms,
    notifications,
    payments,
    reports,
    tours,
    uploads,
)

settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
    # 테스트 결제 자동 환불 (AUTO_REFUND_AFTER_HOURS > 0 일 때만)
    task = asyncio.create_task(auto_refund.loop()) if settings.auto_refund_after_hours > 0 else None
    yield
    if task:
        task.cancel()


app = FastAPI(title="SB Stay API", version="0.1.0", docs_url="/docs", openapi_url="/openapi.json", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_exception_handler(HTTPException, http_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)

API = "/api/v1"
app.include_router(auth.router, prefix=API)
app.include_router(contents.router, prefix=API)
app.include_router(dorms.router, prefix=API)
app.include_router(tours.router, prefix=API)
app.include_router(buddies.router, prefix=API)
app.include_router(buddy_me.router, prefix=API)
app.include_router(ai.router, prefix=API)
app.include_router(bookings.router, prefix=API)
app.include_router(notifications.router, prefix=API)
app.include_router(payments.router, prefix=API)
app.include_router(reports.router, prefix=API)
app.include_router(admin.router, prefix=API)
app.include_router(uploads.router, prefix=API)
app.include_router(uploads.media)  # /media/... 는 /api/v1 밖 (백엔드 주소 기준)


@app.get("/health")
def health() -> dict:
    return {"ok": True, "env": settings.app_env}
