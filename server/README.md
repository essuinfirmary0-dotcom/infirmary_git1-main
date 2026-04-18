# Server Setup

## 1. Install server dependencies

```bash
npm install --prefix server
```

## 2. Create your environment file

A ready-to-use `server/.env` has been added with the current local PostgreSQL settings.
If your PostgreSQL username is not `postgres`, update `DB_USER` before starting the server.

## 3. Create the PostgreSQL database

Run this once from a machine with `psql` installed:

```bash
psql -U postgres -f server/scripts/create-database.sql
```

## 4. Apply the schema

```bash
psql -U postgres -d infirmary_system -f server/scripts/create-schema.sql
```

## 5. Start the backend server

```bash
npm --prefix server run dev
```

## 6. Check the connection

Open `http://localhost:5000/api/health`
