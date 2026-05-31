import requests

def test_auth():
    # Register
    print("Registering...")
    res = requests.post('http://127.0.0.1:8000/api/v1/auth/register', json={
        "username": "testuser",
        "email": "test@user.com",
        "password": "password123"
    })
    print(res.status_code, res.text)
    
    # Login with username
    print("\nLogin with username...")
    res2 = requests.post('http://127.0.0.1:8000/api/v1/auth/login', data={
        "username": "testuser",
        "password": "password123"
    })
    print(res2.status_code, res2.text)

    # Login with email
    print("\nLogin with email...")
    res3 = requests.post('http://127.0.0.1:8000/api/v1/auth/login', data={
        "username": "test@user.com",
        "password": "password123"
    })
    print(res3.status_code, res3.text)

if __name__ == "__main__":
    test_auth()
