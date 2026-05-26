import pytest
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from jose import jwt

from app.core.auth import get_current_user
from app.core.config import settings


def make_credentials(payload: dict) -> HTTPAuthorizationCredentials:
    token = jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
    return HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)

def test_get_current_user_reads_user_id_and_role_admin():
    # arrange: a valid JWT with user_id and admin role
    credentials = make_credentials({"user_id": 1, "role": "admin"})

    # act: decode the current user from credentials
    result = get_current_user(credentials)

    # assert: result should contain the decoded user id and role
    assert result == {"user_id": 1, "role": "admin"}

def test_get_current_user_reads_user_id_and_role_vendor():
    # arrange: a valid JWT with user_id and vendor role
    credentials = make_credentials({"user_id": 2, "role": "vendor"})

    # act: decode the current user from credentials
    result = get_current_user(credentials)

    # assert: result should contain the decoded user id and role
    assert result == {"user_id": 2, "role": "vendor"}

def test_get_current_user_defaults_role_to_employee():
    # arrange: a valid JWT with user_id and no role
    credentials = make_credentials({"user_id": 3})

    # act: decode the current user from credentials
    result = get_current_user(credentials)

    # assert: result should contain the decoded user id and default to employee role
    assert result == {"user_id": 3, "role": "employee"}

def test_get_current_user_accepts_camel_case_user_id():
    # arrange: a valid JWT using userId and no role
    credentials = make_credentials({"userId": 9})

    # act: decode the current user from credentials
    result = get_current_user(credentials)

    # assert: result should use userId and default to employee role
    assert result == {"user_id": 9, "role": "employee"}


def test_get_current_user_rejects_missing_user_id():
    # arrange: a valid JWT without user id fields
    credentials = make_credentials({"role": "employee"})

    # act: decode the current user from credentials
    with pytest.raises(HTTPException) as exc_info:
        get_current_user(credentials)

    # assert: response should be a 401 invalid token error
    assert exc_info.value.status_code == 401
    assert exc_info.value.detail == "Invalid token"


def test_get_current_user_rejects_invalid_token():
    # arrange: an invalid bearer token
    credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials="not-a-jwt")

    # act: decode the current user from credentials
    with pytest.raises(HTTPException) as exc_info:
        get_current_user(credentials)

    # assert: response should be a 401 invalid token error
    assert exc_info.value.status_code == 401
    assert exc_info.value.detail == "Invalid token"
