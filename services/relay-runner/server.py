"""Authenticated FastAPI control plane and relay supervisor in one process."""
import asyncio
from contextlib import asynccontextmanager
import json
import logging
import os
import secrets
import signal
import sys
import threading
import time
from typing import Annotated

from fastapi import Depends, FastAPI, Header, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field
import uvicorn

from configuration import MAX_BODY, Problem, RollbackRequest, SaveRequest, Store
from discovery import Discovery, Policy, probe
from runner import Runner, healthcheck, read_json

VERSION = "0.3.0"
logger = logging.getLogger("kfgyr.runner")


class ProbeRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    url: str = Field(min_length=1, max_length=2048)


class ScanRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    network: str = Field(min_length=1, max_length=32)
    ports: list[int] = Field(default=[80, 443, 5000, 5001, 8080], min_length=1, max_length=8)


class Boundary:
    """Authenticate before reading bodies; cap even chunked requests."""
    def __init__(self, app, token):
        self.app, self.token = app, token.encode()

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        headers = dict(scope.get("headers", []))
        if scope["path"] != "/healthz" and not secrets.compare_digest(headers.get(b"authorization", b""), b"Bearer " + self.token):
            return await JSONResponse({"message": "Érvényes runner API-token szükséges."}, 401, headers={"WWW-Authenticate": "Bearer"})(scope, receive, send)
        body = bytearray()
        while True:
            message = await receive()
            if message["type"] == "http.disconnect":
                return
            body.extend(message.get("body", b""))
            if len(body) > MAX_BODY:
                return await JSONResponse({"message": "Túl nagy kérés."}, 413)(scope, receive, send)
            if not message.get("more_body", False):
                break
        delivered = False
        async def limited_receive():
            nonlocal delivered
            if not delivered:
                delivered = True
                return {"type": "http.request", "body": bytes(body), "more_body": False}
            return await receive()
        await self.app(scope, limited_receive, send)


def create_app(directory=None, token=None, policy=None, supervise=True):
    token = token if token is not None else os.environ.get("KFGYR_RUNNER_API_TOKEN", "")
    if len(token) < 32:
        raise RuntimeError("KFGYR_RUNNER_API_TOKEN must contain at least 32 characters")
    policy = policy or Policy()
    store = Store(directory or os.getenv("KFGYR_CONFIG_DIR", "/var/lib/kfgyr-monitoring"), policy)
    discovery = Discovery(policy)
    runner = None
    thread = None

    @asynccontextmanager
    async def lifespan(app):
        nonlocal runner, thread
        watcher = None
        if supervise:
            runner = Runner()
            thread = threading.Thread(target=runner.run, kwargs={"install_signals": False}, daemon=True)
            thread.start()
            async def watch_supervisor():
                while True:
                    await asyncio.sleep(2)
                    if not thread.is_alive():
                        logger.error("Relay supervisor stopped unexpectedly")
                        os.kill(os.getpid(), signal.SIGTERM)
                        return
            watcher = asyncio.create_task(watch_supervisor())
        try:
            yield
        finally:
            if watcher:
                watcher.cancel()
            await asyncio.to_thread(discovery.shutdown)
            if runner:
                runner.stopping = True
                await asyncio.to_thread(thread.join, 25)

    app = FastAPI(title="KFGyR Relay Runner API", version=VERSION, lifespan=lifespan)
    app.add_middleware(Boundary, token=token)
    app.state.store, app.state.discovery = store, discovery

    @app.exception_handler(Problem)
    async def problem_handler(_request, error):
        return JSONResponse({"message": error.message}, status_code=error.status)

    @app.exception_handler(RequestValidationError)
    async def validation_handler(_request, _error):
        return JSONResponse({"message": "Hibás JSON kérés vagy érvénytelen mezőérték."}, status_code=422)

    @app.exception_handler(Exception)
    async def internal_handler(_request, _error):
        logger.error("Runner API operation failed", exc_info=True)
        return JSONResponse({"message": "A runner művelete nem sikerült. Ellenőrizd a naplót."}, status_code=500)

    def actor(x_kfgyr_actor: Annotated[str | None, Header()] = None):
        return (x_kfgyr_actor or "api-admin")[:200]

    @app.get("/healthz")
    def health():
        alive = not supervise or (thread is not None and thread.is_alive())
        return JSONResponse({"status": "ok" if alive else "failed", "version": VERSION}, status_code=200 if alive else 503)

    @app.get("/v1/config")
    def get_config():
        return store.load()

    @app.put("/v1/config")
    def put_config(body: SaveRequest, user=Depends(actor)):
        return store.save(body.base_revision, body.config, user)

    @app.post("/v1/rollback")
    def rollback(body: RollbackRequest, user=Depends(actor)):
        return store.rollback(body.base_revision, body.revision, user)

    @app.get("/v1/status")
    def status():
        result = read_json(store.directory / "status.json", {"state": "waiting", "message": "A relay konfigurációra vár."})
        if result.get("updated_unix", 0) and time.time() - result["updated_unix"] > 30:
            result.update(state="unavailable", message="A relay állapotjelzése nem frissült.")
        return result

    @app.post("/v1/probe")
    def probe_agent(body: ProbeRequest):
        return probe(policy, body.url)

    @app.get("/v1/networks")
    def networks():
        return {"networks": policy.networks(), "max_addresses": 256, "default_ports": [80, 443, 5000, 5001, 8080]}

    @app.post("/v1/discovery", status_code=202)
    def start_scan(body: ScanRequest):
        return discovery.start(body.network, body.ports)

    @app.get("/v1/discovery/{job_id}")
    def scan_status(job_id: str):
        return discovery.get(job_id)

    @app.get("/v1/discovery")
    def latest_scan():
        return {"job": discovery.latest()}

    @app.delete("/v1/discovery/{job_id}")
    def cancel_scan(job_id: str):
        return discovery.cancel(job_id)

    return app


if __name__ == "__main__":
    os.umask(0o007)
    if "--healthcheck" in sys.argv:
        import urllib.request
        try:
            with urllib.request.urlopen("http://127.0.0.1:" + os.getenv("KFGYR_RUNNER_API_PORT", "8091") + "/healthz", timeout=2) as response:
                assert response.status == 200
            sys.exit(healthcheck())
        except Exception:
            sys.exit(1)
    uvicorn.run(create_app(), host=os.getenv("KFGYR_RUNNER_API_BIND", "0.0.0.0"), port=int(os.getenv("KFGYR_RUNNER_API_PORT", "8091")),
                workers=1, access_log=False, timeout_graceful_shutdown=30)
