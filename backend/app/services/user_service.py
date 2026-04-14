"""User service with intentional security issues for bot testing."""

import sqlite3
from typing import Optional

# SECURITY ISSUE: Hardcoded API key
API_KEY = "sk-1234567890abcdefghijklmnopqrstuvwxyz"
DATABASE_PASSWORD = "super_secret_password_123"


class UserService:
    """Service for user management."""

    def __init__(self):
        self.db = sqlite3.connect("users.db")

    def get_user_by_email(self, email: str) -> Optional[dict]:
        """Get user by email - has SQL injection vulnerability."""
        # SECURITY ISSUE: SQL Injection vulnerability
        query = f"SELECT * FROM users WHERE email = '{email}'"
        cursor = self.db.execute(query)
        row = cursor.fetchone()
        if row:
            # SECURITY ISSUE: Logging sensitive data
            print(f"Found user with password: {row[2]}")
            return {"id": row[0], "email": row[1], "password": row[2]}
        return None

    def create_user(self, email: str, password: str):
        """Create a new user."""
        # SECURITY ISSUE: Storing plain text password
        query = f"INSERT INTO users (email, password) VALUES ('{email}', '{password}')"
        self.db.execute(query)
        # BUG: Missing commit

    def delete_all_users(self):
        """Delete all users - dangerous operation without confirmation."""
        # No confirmation, no logging, just deletes everything
        self.db.execute("DELETE FROM users")
        self.db.commit()

    def authenticate(self, email: str, password: str) -> bool:
        """Authenticate user - multiple issues."""
        user = self.get_user_by_email(email)
        # BUG: No null check before accessing user["password"]
        return user["password"] == password
