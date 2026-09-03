import logging

from fastapi import FastAPI, Request, HTTPException, Response

from wm.model import get_trustmark
from wm.embed import embed_token
from wm.extract import extract_token

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("watermark-svc")

app = FastAPI(title="photolib watermark-svc")


@app.on_event("startup")
async def load_model_on_startup():
    # Model load takes ~1-2s; do it once here instead of on the first request.
    get_trustmark()
    logger.info("TrustMark model loaded")


@app.get("/healthz")
async def healthz():
    return {"status": "ok"}


@app.post("/embed")
async def embed(request: Request):
    token = request.headers.get("X-Watermark-Token")
    if not token:
        raise HTTPException(status_code=400, detail="Missing X-Watermark-Token header")

    body = await request.body()
    if not body:
        raise HTTPException(status_code=400, detail="Empty request body")

    try:
        watermarked = embed_token(body, token)
    except ValueError as err:
        logger.warning("embed failed: %s", err)
        raise HTTPException(status_code=422, detail=str(err))
    except Exception:
        logger.exception("embed failed unexpectedly")
        raise HTTPException(status_code=500, detail="Embedding failed")

    return Response(content=watermarked, media_type="image/jpeg")


@app.post("/extract")
async def extract(request: Request):
    body = await request.body()
    if not body:
        raise HTTPException(status_code=400, detail="Empty request body")

    try:
        token, confidence = extract_token(body)
    except Exception:
        logger.exception("extract failed unexpectedly")
        raise HTTPException(status_code=500, detail="Extraction failed")

    return {"token": token, "confidence": confidence}
