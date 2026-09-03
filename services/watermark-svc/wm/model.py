from trustmark import TrustMark

from .constants import TRUSTMARK_MODEL_TYPE

_instance: TrustMark | None = None


def get_trustmark() -> TrustMark:
    """Lazily-initialized singleton - model load takes ~1-2s and must not
    happen per-request. Call this once eagerly at app startup so the first
    real request isn't the one paying that cost."""
    global _instance
    if _instance is None:
        _instance = TrustMark(verbose=False, model_type=TRUSTMARK_MODEL_TYPE)
    return _instance
