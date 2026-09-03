import re
import string

# Determined empirically (see requirements.txt for the testing that led here): TrustMark's
# 'Q' model reliably round-trips an 8-character alphanumeric payload even under aggressive
# recompression + resizing, but degrades sharply beyond that (9 chars: ~40% failure, 10
# chars: near-total failure) since payload length eats into the model's fixed bit budget
# shared with its own internal error-correction. The token generator in apps/web must
# produce tokens of exactly this length and alphabet.
TOKEN_LENGTH_CHARS = 8
TOKEN_ALPHABET = string.ascii_letters + string.digits

TRUSTMARK_MODEL_TYPE = "Q"

TOKEN_PATTERN = re.compile(rf"^[A-Za-z0-9]{{{TOKEN_LENGTH_CHARS}}}$")
