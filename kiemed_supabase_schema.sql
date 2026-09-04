-- ============================================================
-- KIEMED Hospital Management System — Supabase Database Schema
-- Project Reference: gabapoeejwqueautmkew
-- Description: Complete schema for offline-first clinical sync,
--              multi-clinic management, triage vitals (APGAR, IMNCI, BMI),
--              pharmacy categories, billing & patient balance tracking,
--              patient files, and scan/x-ray media storage.
-- Run this script in the Supabase SQL Editor: https://supabase.com/dashboard/project/gabapoeejwqueautmkew/sql
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── 1. CLINICS & BRANCHES ────────────────────────────────────
CREATE TABLE IF NOT EXISTS clinics (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL,
  address       TEXT,
  phone         TEXT,
  district      TEXT,
  bed_capacity  INTEGER DEFAULT 20,
  admin_email   TEXT,
  logo_url      TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 2. CLINIC SETTINGS & FINANCE PIN ─────────────────────────
CREATE TABLE IF NOT EXISTS clinic_settings (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID REFERENCES clinics(id) ON DELETE CASCADE,
  pin_hash        TEXT,              -- SHA-256 hash of 4-digit PIN (null = PIN disabled)
  show_finances   BOOLEAN DEFAULT FALSE,
  theme           TEXT DEFAULT 'dark',
  currency        TEXT DEFAULT 'UGX',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(clinic_id)
);

-- ─── 3. PATIENTS REGISTRY ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS patients (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id             UUID REFERENCES clinics(id) ON DELETE CASCADE,
  patient_number        TEXT,           -- e.g. KMD-0001
  first_name            TEXT NOT NULL,
  last_name             TEXT NOT NULL,
  date_of_birth         DATE,
  gender                TEXT,           -- 'Female' / 'Male'
  phone                 TEXT,
  nin                   TEXT,           -- National Identification Number
  email                 TEXT,
  address               TEXT,
  district              TEXT,
  blood_group           TEXT,           -- O+, A+, B+, AB+, etc.
  allergies             TEXT,
  chronic_conditions    TEXT,
  next_of_kin           TEXT,
  nok_phone             TEXT,
  outstanding_balance   NUMERIC(12,2) DEFAULT 0,
  is_maternity          BOOLEAN DEFAULT FALSE,  -- Enables APGAR newborn scoring in Triage
  is_pediatric          BOOLEAN DEFAULT FALSE,  -- Enables IMNCI protocol for children < 5y
  notes                 TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_patients_clinic ON patients(clinic_id);
CREATE INDEX IF NOT EXISTS idx_patients_phone ON patients(phone);

-- ─── 4. TRIAGE & VITALS ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS vitals (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id               UUID REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id              UUID REFERENCES patients(id) ON DELETE CASCADE,
  temperature             NUMERIC(5,2),     -- °C
  blood_pressure          TEXT,             -- e.g. "120/80"
  heart_rate              INTEGER,          -- bpm (Pulse)
  respiratory_rate        INTEGER,          -- breaths/min
  oxygen_sat              NUMERIC(5,2),     -- SpO2 %
  weight                  NUMERIC(6,2),     -- kg
  height                  NUMERIC(6,2),     -- cm
  bmi                     NUMERIC(5,2),     -- Auto-calculated: weight / (height/100)^2
  bmi_category            TEXT,             -- 'Underweight' / 'Normal weight' / 'Overweight' / 'Obese'
  muac                    NUMERIC(5,2),     -- Mid-upper arm circumference (cm) for child nutrition
  blood_glucose           NUMERIC(6,2),     -- mmol/L
  pain_scale              INTEGER,          -- 0-10
  chief_complaint         TEXT,
  priority                TEXT DEFAULT 'Normal',  -- 'Emergency' / 'Urgent' / 'Normal'
  nurse_notes             TEXT,
  recorded_by             TEXT,

  -- Uganda MoH APGAR Newborn Score (Maternity only)
  apgar_1min              INTEGER,          -- 0 to 10
  apgar_5min              INTEGER,
  apgar_10min             INTEGER,
  apgar_total             INTEGER,
  apgar_interpretation    TEXT,

  -- Uganda MoH IMNCI Protocol (Children < 5y)
  imnci_general_danger_signs JSONB DEFAULT '[]'::jsonb,
  imnci_classifications      JSONB DEFAULT '[]'::jsonb,

  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vitals_patient ON vitals(patient_id);
CREATE INDEX IF NOT EXISTS idx_vitals_clinic ON vitals(clinic_id);

-- ─── 5. CLINICAL CONSULTATIONS ────────────────────────────────
CREATE TABLE IF NOT EXISTS consultations (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id     UUID REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id    UUID REFERENCES patients(id) ON DELETE CASCADE,
  doctor        TEXT,
  complaint     TEXT,
  examination   TEXT,
  diagnosis     TEXT NOT NULL,
  plan          TEXT,
  prescription  TEXT,
  status        TEXT DEFAULT 'completed',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consultations_patient ON consultations(patient_id);
CREATE INDEX IF NOT EXISTS idx_consultations_clinic ON consultations(clinic_id);

-- ─── 6. PHARMACY INVENTORY & STOCK ────────────────────────────
CREATE TABLE IF NOT EXISTS inventory (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID REFERENCES clinics(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  category        TEXT NOT NULL,    -- Uganda drug classes: Antibiotics, Antimalarials, etc., or user-typed
  unit            TEXT DEFAULT 'Tablets',
  current_stock   INTEGER NOT NULL DEFAULT 0,
  reorder_level   INTEGER DEFAULT 20,
  unit_price      NUMERIC(12,2) NOT NULL DEFAULT 0,
  supplier        TEXT,
  expiry_date     DATE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_clinic ON inventory(clinic_id);
CREATE INDEX IF NOT EXISTS idx_inventory_category ON inventory(category);

-- ─── 7. PHARMACY DISPENSING & OTC LOG ─────────────────────────
CREATE TABLE IF NOT EXISTS dispensing (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id      UUID REFERENCES patients(id) ON DELETE SET NULL,
  patient_name    TEXT,
  customer_phone  TEXT,
  items           TEXT NOT NULL,
  is_direct_sale  BOOLEAN DEFAULT FALSE,  -- True for walk-in / OTC pass-by sales
  status          TEXT DEFAULT 'dispensed',
  dispensed_by    TEXT,
  dispensed_at    TIMESTAMPTZ DEFAULT NOW(),
  total_amount    NUMERIC(12,2) DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dispensing_clinic ON dispensing(clinic_id);
CREATE INDEX IF NOT EXISTS idx_dispensing_patient ON dispensing(patient_id);

-- ─── 8. LABORATORY REQUESTS & RESULTS ─────────────────────────
CREATE TABLE IF NOT EXISTS lab_requests (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id     UUID REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id    UUID REFERENCES patients(id) ON DELETE CASCADE,
  patient_name  TEXT,
  test_name     TEXT NOT NULL,
  status        TEXT DEFAULT 'pending', -- 'pending' / 'completed' / 'cancelled'
  results       TEXT,
  requested_by  TEXT,
  completed_by  TEXT,
  cost          NUMERIC(12,2) DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lab_requests_patient ON lab_requests(patient_id);

-- ─── 9. BILLING, INVOICING & PATIENT BALANCES ─────────────────
CREATE TABLE IF NOT EXISTS invoices (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id      UUID REFERENCES patients(id) ON DELETE SET NULL,
  patient_name    TEXT NOT NULL,
  customer_phone  TEXT,
  category        TEXT,                   -- e.g. 'General Outpatient', 'OTC / Direct Drug Sale'
  description     TEXT NOT NULL,
  amount_due      NUMERIC(12,2) NOT NULL DEFAULT 0,
  amount_paid     NUMERIC(12,2) NOT NULL DEFAULT 0,
  balance         NUMERIC(12,2) NOT NULL DEFAULT 0,  -- amount_due - amount_paid
  payment_method  TEXT DEFAULT 'Cash',    -- 'Cash', 'MTN Mobile Money', 'Airtel Money', etc.
  status          TEXT DEFAULT 'Unpaid',  -- 'Cleared', 'Partial', 'Unpaid'
  is_direct_sale  BOOLEAN DEFAULT FALSE,  -- True for direct pharmacy pass-by sales
  last_payment_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoices_clinic ON invoices(clinic_id);
CREATE INDEX IF NOT EXISTS idx_invoices_patient ON invoices(patient_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);

-- ─── 10. PATIENT SCANS, X-RAYS & MEDIA DOCUMENTS ──────────────
CREATE TABLE IF NOT EXISTS patient_documents (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id     UUID REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id    UUID REFERENCES patients(id) ON DELETE CASCADE,
  patient_name  TEXT,
  doc_type      TEXT NOT NULL,    -- 'X-Ray Scan', 'Ultrasound Scan', 'CT / MRI Scan', 'Lab Photo', etc.
  title         TEXT NOT NULL,
  notes         TEXT,
  file_name     TEXT,
  file_data     TEXT,             -- Base64 Data URL or remote URL
  uploaded_at   TIMESTAMPTZ DEFAULT NOW(),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_patient_docs_patient ON patient_documents(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_docs_clinic ON patient_documents(clinic_id);

-- ─── 11. INPATIENT ADMISSIONS & BEDS ──────────────────────────
CREATE TABLE IF NOT EXISTS beds (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id     UUID REFERENCES clinics(id) ON DELETE CASCADE,
  ward          TEXT NOT NULL,    -- 'General Medical Ward', 'Maternity Ward', 'Pediatric Ward', etc.
  bed_number    TEXT NOT NULL,    -- e.g. 'BED-01'
  status        TEXT DEFAULT 'available', -- 'available' / 'occupied' / 'maintenance'
  patient_id    UUID REFERENCES patients(id) ON DELETE SET NULL,
  patient_name  TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admissions (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id     UUID REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id    UUID REFERENCES patients(id) ON DELETE CASCADE,
  patient_name  TEXT,
  ward          TEXT NOT NULL,
  bed_number    TEXT NOT NULL,
  admit_date    TIMESTAMPTZ DEFAULT NOW(),
  discharge_date TIMESTAMPTZ,
  admitted_by   TEXT,
  reason        TEXT,
  status        TEXT DEFAULT 'admitted', -- 'admitted' / 'discharged'
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 12. HOSPITAL STAFF & APPOINTMENTS ────────────────────────
CREATE TABLE IF NOT EXISTS staff (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id     UUID REFERENCES clinics(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  role          TEXT NOT NULL,
  department    TEXT NOT NULL,
  council_no    TEXT,             -- Medical/Nursing/Pharmacy Council Registration Number
  phone         TEXT,
  email         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS appointments (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id         UUID REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id        UUID REFERENCES patients(id) ON DELETE SET NULL,
  patient_name      TEXT NOT NULL,
  appointment_type  TEXT NOT NULL,
  appointment_date  DATE NOT NULL,
  appointment_time  TEXT NOT NULL,
  doctor            TEXT,
  status            TEXT DEFAULT 'Scheduled', -- 'Scheduled' / 'Completed' / 'Cancelled'
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 13. AUDIT LOGS ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id   UUID REFERENCES clinics(id) ON DELETE CASCADE,
  user_id     UUID,
  action      TEXT NOT NULL,
  table_name  TEXT NOT NULL,
  record_id   TEXT,
  details     JSONB,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── AUTOMATIC UPDATED_AT TRIGGER ─────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'clinics','clinic_settings','patients','vitals','consultations',
    'inventory','dispensing','lab_requests','invoices','patient_documents',
    'beds','admissions','staff','appointments'
  ] LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_%s_updated_at ON %s;', tbl, tbl
    );
    EXECUTE format(
      'CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON %s FOR EACH ROW EXECUTE FUNCTION update_updated_at();',
      tbl, tbl
    );
  END LOOP;
END;
$$;

-- ─── 14. ROW LEVEL SECURITY (RLS) POLICIES ────────────────────
ALTER TABLE clinics           ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinic_settings   ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients          ENABLE ROW LEVEL SECURITY;
ALTER TABLE vitals            ENABLE ROW LEVEL SECURITY;
ALTER TABLE consultations     ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory         ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispensing        ENABLE ROW LEVEL SECURITY;
ALTER TABLE lab_requests      ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices          ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE beds              ENABLE ROW LEVEL SECURITY;
ALTER TABLE admissions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff             ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments      ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs        ENABLE ROW LEVEL SECURITY;

-- Allow unrestricted read/write for both anonymous key (offline-first sync) and authenticated staff
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'clinics','clinic_settings','patients','vitals','consultations',
    'inventory','dispensing','lab_requests','invoices','patient_documents',
    'beds','admissions','staff','appointments','audit_logs'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Allow anon all" ON %s;', tbl);
    EXECUTE format('CREATE POLICY "Allow anon all" ON %s FOR ALL TO anon USING (true) WITH CHECK (true);', tbl);

    EXECUTE format('DROP POLICY IF EXISTS "Allow authenticated all" ON %s;', tbl);
    EXECUTE format('CREATE POLICY "Allow authenticated all" ON %s FOR ALL TO authenticated USING (true) WITH CHECK (true);', tbl);
  END LOOP;
END;
$$;

-- ─── 15. REALTIME REPLICATION PUBLICATION ─────────────────────
-- Ensures multi-device real-time sync across hospital terminals
DO $$
BEGIN
  -- Add tables to realtime publication safely
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE
      clinics, clinic_settings, patients, vitals, consultations,
      inventory, dispensing, lab_requests, invoices, patient_documents,
      beds, admissions, staff, appointments;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN others THEN NULL;
  END;
END;
$$;

-- Done! Your Supabase database is now fully prepared for KIEMED HMS.
