import requests
import json

def test_login(username, password):
    url = 'http://127.0.0.1:8000/api/v1/auth/login'
    data = {'username': username, 'password': password}
    response = requests.post(url, data=data)
    print(f"Login {username}:", response.status_code, response.text)

if __name__ == "__main__":
    test_login('Ravi', 'password_here') # I don't know the password
