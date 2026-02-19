"""
Authentication and authorization SQL queries.

All SQL related to authentication and authorization is consolidated here.

Expected users table schema:
    CREATE TABLE users (
        id              SERIAL PRIMARY KEY,
        username        VARCHAR(50)  UNIQUE NOT NULL,
        email           VARCHAR(255) UNIQUE NOT NULL,
        hashed_password TEXT NOT NULL,
        full_name       VARCHAR(100) NOT NULL,
        is_active       BOOLEAN DEFAULT TRUE,
        is_superuser    BOOLEAN DEFAULT FALSE,
        created_at      TIMESTAMPTZ DEFAULT NOW(),
        updated_at      TIMESTAMPTZ DEFAULT NOW()
    );
"""
from typing import Optional

import psycopg
from psycopg.rows import dict_row

from app.logger import logger
from app.exceptions import AppMessages, DatabaseException


class AuthQueries:
    """Centralized class for all authentication and authorization SQL queries."""

    # @staticmethod
    # async def get_user_by_username(
    #     conn: psycopg.AsyncConnection, username: str
    # ) -> Optional[dict]:
    #     """Retrieve a user record by username."""
    #     sql = """
    #         SELECT id, username, email, hashed_password, full_name,
    #                is_active, is_superuser, created_at, updated_at
    #         FROM users
    #         WHERE username = %s
    #     """
    #     try:
    #         async with conn.cursor(row_factory=dict_row) as cur:
    #             await cur.execute(sql, (username,))
    #             return await cur.fetchone()
    #     except Exception as e:
    #         logger.error(f"get_user_by_username failed: {e}")
    #         raise DatabaseException(AppMessages.DATABASE_QUERY_FAILED)

    # @staticmethod
    # async def get_user_by_email(
    #     conn: psycopg.AsyncConnection, email: str
    # ) -> Optional[dict]:
    #     """Retrieve a user record by email."""
    #     sql = """
    #         SELECT id, username, email, hashed_password, full_name,
    #                is_active, is_superuser, created_at, updated_at
    #         FROM users
    #         WHERE email = %s
    #     """
    #     try:
    #         async with conn.cursor(row_factory=dict_row) as cur:
    #             await cur.execute(sql, (email,))
    #             return await cur.fetchone()
    #     except Exception as e:
    #         logger.error(f"get_user_by_email failed: {e}")
    #         raise DatabaseException(AppMessages.DATABASE_QUERY_FAILED)

    # @staticmethod
    # async def get_user_by_id(
    #     conn: psycopg.AsyncConnection, user_id: int
    # ) -> Optional[dict]:
    #     """Retrieve a user record by ID (excludes hashed_password)."""
    #     sql = """
    #         SELECT id, username, email, full_name,
    #                is_active, is_superuser, created_at, updated_at
    #         FROM users
    #         WHERE id = %s
    #     """
    #     try:
    #         async with conn.cursor(row_factory=dict_row) as cur:
    #             await cur.execute(sql, (user_id,))
    #             return await cur.fetchone()
    #     except Exception as e:
    #         logger.error(f"get_user_by_id failed: {e}")
    #         raise DatabaseException(AppMessages.DATABASE_QUERY_FAILED)

    # @staticmethod
    # async def check_user_exists(
    #     conn: psycopg.AsyncConnection, username: str, email: str
    # ) -> bool:
    #     """Return True if a user with the given username or email already exists."""
    #     sql = """
    #         SELECT EXISTS (
    #             SELECT 1 FROM users
    #             WHERE username = %s OR email = %s
    #         )
    #     """
    #     try:
    #         async with conn.cursor() as cur:
    #             await cur.execute(sql, (username, email))
    #             row = await cur.fetchone()
    #             return bool(row[0])
    #     except Exception as e:
    #         logger.error(f"check_user_exists failed: {e}")
    #         raise DatabaseException(AppMessages.DATABASE_QUERY_FAILED)

    # @staticmethod
    # async def create_user(
    #     conn: psycopg.AsyncConnection,
    #     username: str,
    #     email: str,
    #     hashed_password: str,
    #     full_name: str,
    # ) -> dict:
    #     """Insert a new user and return the created record."""
    #     sql = """
    #         INSERT INTO users (username, email, hashed_password, full_name)
    #         VALUES (%s, %s, %s, %s)
    #         RETURNING id, username, email, full_name,
    #                   is_active, is_superuser, created_at, updated_at
    #     """
    #     try:
    #         async with conn.cursor(row_factory=dict_row) as cur:
    #             await cur.execute(sql, (username, email, hashed_password, full_name))
    #             return await cur.fetchone()
    #     except Exception as e:
    #         logger.error(f"create_user failed: {e}")
    #         raise DatabaseException(AppMessages.DATABASE_QUERY_FAILED)

    # @staticmethod
    # async def update_last_login(
    #     conn: psycopg.AsyncConnection, user_id: int
    # ) -> None:
    #     """Stamp updated_at on the user row to record the last login time."""
    #     sql = """
    #         UPDATE users
    #         SET updated_at = NOW()
    #         WHERE id = %s
    #     """
    #     try:
    #         async with conn.cursor() as cur:
    #             await cur.execute(sql, (user_id,))
    #     except Exception as e:
    #         logger.error(f"update_last_login failed: {e}")
    #         raise DatabaseException(AppMessages.DATABASE_QUERY_FAILED)
