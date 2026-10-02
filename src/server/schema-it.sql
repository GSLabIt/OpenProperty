-- GSLabIt fork: Italian rental data, kept out of upstream's schema.sql so merges stay clean.
CREATE TABLE IF NOT EXISTS lease_it (
  lease_id INTEGER PRIMARY KEY REFERENCES leases(id) ON DELETE CASCADE,
  contract_type TEXT,                              -- free text, list is configurable (settings.it_contract_types)
  tax_regime TEXT NOT NULL DEFAULT 'irpef',        -- 'irpef' | 'cedolare_21' | 'cedolare_10'
  registration_tax_mode TEXT NOT NULL DEFAULT 'annual', -- 'annual' | 'full_term'
  payment_method TEXT,                             -- free text, configurable (settings.it_payment_methods)
  registration_date TEXT,
  registration_number TEXT,
  istat_mode TEXT,                                 -- label from settings.it_istat_modes
  istat_last_adjust TEXT                           -- ISO date of the last applied adjustment
);

CREATE TABLE IF NOT EXISTS unit_it (
  unit_id INTEGER PRIMARY KEY REFERENCES units(id) ON DELETE CASCADE,
  cadastral_category TEXT,                         -- e.g. A/2, C/6
  cadastral_income REAL,                           -- rendita catastale (EUR)
  cadastral_ref TEXT,                              -- foglio / particella / sub
  ownership_pct REAL NOT NULL DEFAULT 100,
  imu_exempt INTEGER NOT NULL DEFAULT 0            -- 1 = abitazione principale etc.
);

CREATE TABLE IF NOT EXISTS foi_index (
  month TEXT PRIMARY KEY,                          -- 'YYYY-MM'
  value REAL NOT NULL                              -- ISTAT FOI index (no tobacco)
);
