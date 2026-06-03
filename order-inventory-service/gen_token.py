"""
Dev-only token generator.
Usage: python gen_token.py
"""
import os
import time
from jose import jwt
# from dotenv import load_dotenv

# load_dotenv()

SECRET = os.getenv("JWT_SECRET", "supersecret_change_me")
ALGO = "HS256"
EXPIRE_DAYS = 30

tokens = {
    "employee (user_id=1)": {"user_id": 1, "role": "employee"},
    "employee (user_id=2)": {"user_id": 2, "role": "employee"},
    "employee (user_id=3)": {"user_id": 3, "role": "employee"},
    "vendor   (user_id=100)": {"user_id": 100, "role": "vendor"},
    "vendor   (user_id=101)": {"user_id": 101, "role": "vendor"},
    "vendor   (user_id=102)": {"user_id": 102, "role": "vendor"},
    "admin    (user_id=999)": {"user_id": 999, "role": "admin"},
}

exp = int(time.time()) + 86400 * EXPIRE_DAYS

print(f"JWT_SECRET = {SECRET}\n")
for label, payload in tokens.items():
    token = jwt.encode({**payload, "exp": exp}, SECRET, algorithm=ALGO)
    print(f"--- {label} ---")
    print(token)
    print()
