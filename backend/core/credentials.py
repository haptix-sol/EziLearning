"""Encrypt/decrypt portal credentials. Uses Fernet with SECRET_KEY from env."""
import base64
import hashlib
import os

from cryptography.fernet import Fernet, InvalidToken


def _get_fernet() -> Fernet | None:
    """Create Fernet from SECRET_KEY env. Returns None if not configured."""
    secret = os.environ.get("SECRET_KEY") or os.environ.get("CREDENTIALS_SECRET")
    if not secret:
        return None
    key = base64.urlsafe_b64encode(hashlib.sha256(secret.encode()).digest())
    return Fernet(key)


def encrypt_password(password: str) -> str | None:
    """Encrypt password. Raises RuntimeError if SECRET_KEY not set (avoids plain-text storage)."""
    f = _get_fernet()
    if not f:
        raise RuntimeError(
            "SECRET_KEY or CREDENTIALS_SECRET must be set in environment to encrypt portal passwords. "
            "Add SECRET_KEY=<random-32-chars> to .env"
        )
    return f.encrypt(password.encode()).decode()


def decrypt_password(encrypted: str) -> str:
    """Decrypt password. Returns as-is if decryption fails or SECRET_KEY not set."""
    f = _get_fernet()
    if not f:
        return encrypted  # Cannot decrypt without key; caller may have legacy plain-text
    try:
        return f.decrypt(encrypted.encode()).decode()
    except (InvalidToken, Exception):
        return encrypted
