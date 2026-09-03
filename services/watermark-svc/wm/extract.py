import io
from typing import Optional, Tuple

from PIL import Image

from .constants import TOKEN_PATTERN
from .model import get_trustmark


def extract_token(jpg_bytes: bytes) -> Tuple[Optional[str], float]:
    """Returns (token, confidence). token is None if nothing plausible was
    recovered - extraction against a heavily-transformed image can still
    produce garbage, so the recovered string is sanity-checked against the
    known token format before being trusted."""
    img = Image.open(io.BytesIO(jpg_bytes)).convert("RGB")

    recovered, present, confidence = get_trustmark().decode(img)

    if not present or not TOKEN_PATTERN.match(recovered):
        return None, float(confidence) if present else 0.0

    return recovered, float(confidence)
