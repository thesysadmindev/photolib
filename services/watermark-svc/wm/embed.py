import io

from PIL import Image

from .constants import TOKEN_LENGTH_CHARS
from .model import get_trustmark


def embed_token(jpg_bytes: bytes, token: str, quality: int = 95) -> bytes:
    if len(token) != TOKEN_LENGTH_CHARS:
        raise ValueError(f"token must be exactly {TOKEN_LENGTH_CHARS} characters")

    img = Image.open(io.BytesIO(jpg_bytes)).convert("RGB")

    watermarked = get_trustmark().encode(img, token)

    out = io.BytesIO()
    watermarked.save(out, format="JPEG", quality=quality)
    return out.getvalue()
