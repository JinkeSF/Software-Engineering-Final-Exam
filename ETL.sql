-- ========================================================
-- TFR Database ETL Process
-- Based on the methodology: Staging -> Transform -> Normalize
-- ========================================================

-- Step 1: Environment Setup & Cleanup
-- Purpose: Ensure a fresh start by removing existing tables
DROP TABLE IF EXISTS FertilityRecord;
DROP TABLE IF EXISTS Country;
DROP TABLE IF EXISTS SubRegion;
DROP TABLE IF EXISTS Region;
DROP TABLE IF EXISTS temp_tfr;       -- Staging table for data1.csv
DROP TABLE IF EXISTS temp_nations;   -- Staging table for data2.csv

-- Step 2: Create Temporary Tables (Staging Area)
-- Purpose: Create tables that match the raw CSV structure exactly
CREATE TABLE temp_tfr (
    Entity TEXT,
    Code TEXT,
    Year INTEGER,
    TFR REAL
);

CREATE TABLE temp_nations (
    name TEXT,
    alpha_2 TEXT,
    alpha_3 TEXT,
    country_code INTEGER,
    iso_3166_2 TEXT,
    region TEXT,
    sub_region TEXT,
    intermediate_region TEXT,
    region_code INTEGER,
    sub_region_code INTEGER,
    intermediate_region_code INTEGER
);

-- Step 3: Load Raw Data
-- Note: In SQLite, we use the .import command or external script to load data.
-- The actual data loading will be handled by our setup script (init_db.js),
-- effectively simulating the 'LOAD DATA INFILE' step from your notes.

-- Step 4: Create Target Tables (Normalized Schema)
-- Purpose: Define the 3NF schema structure

-- 4.1 Region Table
CREATE TABLE Region (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE
);

-- 4.2 SubRegion Table
CREATE TABLE SubRegion (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE,
    region_id INTEGER,
    FOREIGN KEY(region_id) REFERENCES Region(id)
);

-- 4.3 Country Table
CREATE TABLE Country (
    alpha_3_code TEXT PRIMARY KEY,
    name TEXT,
    alpha_2_code TEXT,
    sub_region_id INTEGER,
    FOREIGN KEY(sub_region_id) REFERENCES SubRegion(id)
);

-- 4.4 FertilityRecord Table (The Fact Table)
CREATE TABLE FertilityRecord (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    country_code TEXT,
    year INTEGER,
    tfr REAL,
    UNIQUE(country_code, year),
    FOREIGN KEY(country_code) REFERENCES Country(alpha_3_code)
);

-- Step 5: Transform and Load Regions
-- Methodology: Extract distinct region names from temp_nations
INSERT OR IGNORE INTO Region (name)
SELECT DISTINCT region 
FROM temp_nations 
WHERE region IS NOT NULL AND region != '';

-- Step 6: Transform and Load SubRegions
-- Methodology: Map SubRegions to their parent Region IDs
INSERT OR IGNORE INTO SubRegion (name, region_id)
SELECT DISTINCT tn.sub_region, r.id
FROM temp_nations tn
JOIN Region r ON tn.region = r.name
WHERE tn.sub_region IS NOT NULL AND tn.sub_region != '';

-- Step 7: Transform and Load Countries
-- Methodology: Link Countries to SubRegion IDs and clean codes
INSERT OR IGNORE INTO Country (alpha_3_code, name, alpha_2_code, sub_region_id)
SELECT DISTINCT tn.alpha_3, tn.name, tn.alpha_2, s.id
FROM temp_nations tn
JOIN SubRegion s ON tn.sub_region = s.name
WHERE tn.alpha_3 IS NOT NULL AND tn.alpha_3 != '';

-- Step 8: Transform and Load Fertility Records
-- Methodology: 
-- 1. Join temp_tfr with Country table to ensure referential integrity
-- 2. Filter out null TFRs
INSERT OR IGNORE INTO FertilityRecord (country_code, year, tfr)
SELECT t.Code, t.Year, t.TFR
FROM temp_tfr t
JOIN Country c ON t.Code = c.alpha_3_code
WHERE t.TFR IS NOT NULL;

-- Step 9: Cleanup
-- Purpose: Remove temporary tables to free up space
DROP TABLE temp_tfr;
DROP TABLE temp_nations;