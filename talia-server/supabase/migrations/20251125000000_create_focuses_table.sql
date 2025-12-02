CREATE TABLE focuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  type TEXT,
  is_standard BOOLEAN DEFAULT FALSE,
  assigned_roles TEXT[] NOT NULL,
  is_default BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES auth.users(id),
  layout_data JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Optional: Add a GIN index for faster searching on assigned_roles
CREATE INDEX idx_focuses_assigned_roles ON focuses USING GIN (assigned_roles);