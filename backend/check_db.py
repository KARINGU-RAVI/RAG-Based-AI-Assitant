import asyncio
import sqlite3

def check_users():
    conn = sqlite3.connect('c:/Users/syner/OneDrive/Desktop/Ai Assistant RAG/backend/rag_assistant.db')
    cursor = conn.cursor()
    cursor.execute("SELECT id, username, email, hashed_password FROM users")
    users = cursor.fetchall()
    for u in users:
        print(u)
    conn.close()

if __name__ == "__main__":
    check_users()
