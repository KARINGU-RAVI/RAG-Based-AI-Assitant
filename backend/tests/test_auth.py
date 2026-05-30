import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_user_registration(client: AsyncClient):
    """Verifies that new users can register and the first user is promoted to admin role."""
    reg_payload = {
        "username": "testeradmin",
        "email": "test@example.com",
        "password": "strongpassword123"
    }
    
    response = await client.post("/api/v1/auth/register", json=reg_payload)
    assert response.status_code == 201
    
    data = response.json()
    assert data["username"] == "testeradmin"
    assert data["email"] == "test@example.com"
    # First registered user must be auto-promoted to 'admin'
    assert data["role"] == "admin"
    assert "id" in data

@pytest.mark.asyncio
async def test_duplicate_user_registration_fails(client: AsyncClient):
    """Checks that registering existing usernames or emails throws HTTP 400 Bad Request."""
    reg_payload = {
        "username": "testeradmin",
        "email": "test@example.com",
        "password": "strongpassword123"
    }
    
    response = await client.post("/api/v1/auth/register", json=reg_payload)
    assert response.status_code == 400

@pytest.mark.asyncio
async def test_user_login(client: AsyncClient):
    """Verifies authentication checks verify credentials and issue valid JWT bearer tokens."""
    login_payload = {
        "username": "testeradmin",
        "password": "strongpassword123"
    }
    
    response = await client.post("/api/v1/auth/login", data=login_payload)
    assert response.status_code == 200
    
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["role"] == "admin"
    assert data["username"] == "testeradmin"

@pytest.mark.asyncio
async def test_unauthorized_profile_fetch(client: AsyncClient):
    """Checks that fetching user profiles without bearer token authorization throws 401."""
    response = await client.get("/api/v1/auth/me")
    assert response.status_code == 401
