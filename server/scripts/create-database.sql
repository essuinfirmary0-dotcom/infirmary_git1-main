SELECT 'CREATE DATABASE infirmary_system'
WHERE NOT EXISTS (
  SELECT FROM pg_database WHERE datname = 'infirmary_system'
)\gexec
