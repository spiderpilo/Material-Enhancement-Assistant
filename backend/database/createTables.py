"""
Script to create database tables for the Material Enhancement Assistant.
Run this script once to initialize the database with all required tables.
"""

import os
from sqlalchemy import create_engine, MetaData, Table, Column, Integer, String, Boolean, DateTime, JSON
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Fetch variables
USER = os.getenv("user")
PASSWORD = os.getenv("password")
HOST = os.getenv("host")
PORT = os.getenv("port")
DBNAME = os.getenv("dbname")

# Construct the SQLAlchemy connection string
DATABASE_URL = f"postgresql+psycopg2://{USER}:{PASSWORD}@{HOST}:{PORT}/{DBNAME}?sslmode=require"


# Database configuration
engine = create_engine(DATABASE_URL, echo=True)
metadata = MetaData()

# Define User table
users_table = Table(
    'users',
    metadata,
    Column('id', Integer, primary_key=True),
    Column('username', String(80), unique=True, nullable=False, index=True),
    Column('profession', String(80), nullable=False, index=True),
    Column('associated_materials', JSON, default=list),
)


def create_tables():
    """Create all database tables"""
    print("Creating database tables...")
    metadata.create_all(engine)
    print("✓ Database tables created successfully!")
    print(f"✓ Database URI: {DATABASE_URL}")


if __name__ == '__main__':
    create_tables()
