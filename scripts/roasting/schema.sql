-- Immutable file versions; publication changes only after a complete import.
CREATE TABLE IF NOT EXISTS roast_versions (
  version_id TEXT PRIMARY KEY,
  path TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  parser_version TEXT NOT NULL,
  roast_id TEXT NOT NULL,
  country TEXT NOT NULL,
  origin TEXT NOT NULL,
  suborigin TEXT NOT NULL,
  roast_date TEXT,
  eligible INTEGER NOT NULL CHECK(eligible IN (0,1)),
  summary_json TEXT NOT NULL,
  detail_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS roast_imports (
  import_id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  sources_json TEXT NOT NULL,
  mode TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS roast_members (
  import_id TEXT NOT NULL REFERENCES roast_imports(import_id),
  path TEXT NOT NULL,
  version_id TEXT NOT NULL REFERENCES roast_versions(version_id),
  PRIMARY KEY(import_id, path)
);
CREATE TABLE IF NOT EXISTS roast_active (
  singleton INTEGER PRIMARY KEY CHECK(singleton = 1),
  import_id TEXT NOT NULL REFERENCES roast_imports(import_id)
);
CREATE INDEX IF NOT EXISTS roast_members_version ON roast_members(version_id);
CREATE INDEX IF NOT EXISTS roast_versions_roast ON roast_versions(roast_id);
