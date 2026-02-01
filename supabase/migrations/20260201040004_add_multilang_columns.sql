-- Add multilingual columns to testimonials table
ALTER TABLE testimonials
ADD COLUMN IF NOT EXISTS text_fr TEXT,
ADD COLUMN IF NOT EXISTS text_en TEXT,
ADD COLUMN IF NOT EXISTS text_pt TEXT,
ADD COLUMN IF NOT EXISTS author_name_fr TEXT,
ADD COLUMN IF NOT EXISTS author_name_en TEXT,
ADD COLUMN IF NOT EXISTS author_name_pt TEXT,
ADD COLUMN IF NOT EXISTS city_fr TEXT,
ADD COLUMN IF NOT EXISTS city_en TEXT,
ADD COLUMN IF NOT EXISTS city_pt TEXT,
ADD COLUMN IF NOT EXISTS state_fr TEXT,
ADD COLUMN IF NOT EXISTS state_pt TEXT,
ADD COLUMN IF NOT EXISTS state_en TEXT;

-- Migrate existing data to French columns
UPDATE testimonials
SET
  text_fr = text,
  author_name_fr = author_name,
  city_fr = city,
  state_fr = state
WHERE text_fr IS NULL AND text IS NOT NULL;