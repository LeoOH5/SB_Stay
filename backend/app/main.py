from fastapi import FastAPI, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.core.errors import http_exception_handler, validation_exception_handler
from app.routers import admin, ai, auth, bookings, buddies, contents, dorms, tours

settings = get_settings()

app = FastAPI(title="SB Stay API", version="0.1.0", docs_url="/docs", openapi_url="/openapi.json")
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
app.include_router(ai.router, prefix=API)
app.include_router(bookings.router, prefix=API)
app.include_router(admin.router, prefix=API)


@app.get("/health")
def health() -> dict:
    return {"ok": True, "env": settings.app_env}
