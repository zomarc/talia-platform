-- Seed canonical UI theme definitions and bundled SVG assets into config (database source of truth).
-- Application code merges these with built-in defaults; ON CONFLICT preserves any existing overrides.

INSERT INTO talia_config.setting (category, setting_key, setting_value, display_name, description, is_editable)
VALUES (
  'ui_appearance',
  'theme_registry',
  $themes${
    "midnight": {"label": "Midnight", "swatch": "#1a1d33", "bg": {"solid": [26, 29, 51], "g1": [17, 19, 37], "g2": [32, 36, 59]}, "palette": "default", "defaultHeaderLogoUrl": null},
    "charcoal": {"label": "Charcoal", "swatch": "#1e1e22", "bg": {"solid": [30, 30, 34], "g1": [20, 20, 24], "g2": [38, 38, 44]}, "palette": "default", "defaultHeaderLogoUrl": null},
    "navy": {"label": "Navy", "swatch": "#12182a", "bg": {"solid": [18, 24, 42], "g1": [12, 16, 30], "g2": [26, 34, 56]}, "palette": "default", "defaultHeaderLogoUrl": null},
    "graphite": {"label": "Graphite", "swatch": "#222428", "bg": {"solid": [34, 36, 40], "g1": [24, 26, 30], "g2": [42, 44, 50]}, "palette": "default", "defaultHeaderLogoUrl": null},
    "ocean": {"label": "Ocean", "swatch": "#121e26", "bg": {"solid": [18, 30, 38], "g1": [12, 20, 28], "g2": [26, 40, 52]}, "palette": "default", "defaultHeaderLogoUrl": null},
    "obsidian": {"label": "Obsidian", "swatch": "#101014", "bg": {"solid": [16, 16, 20], "g1": [10, 10, 14], "g2": [22, 22, 28]}, "palette": "default", "defaultHeaderLogoUrl": null},
    "porcelain": {"label": "Porcelain (light)", "swatch": "#e8eaef", "bg": {"solid": [236, 238, 242], "g1": [248, 249, 251], "g2": [226, 230, 238]}, "palette": "light", "defaultHeaderLogoUrl": null},
    "linen": {"label": "Linen (light)", "swatch": "#ebe6dc", "bg": {"solid": [240, 236, 228], "g1": [250, 247, 240], "g2": [230, 224, 212]}, "palette": "light", "defaultHeaderLogoUrl": null},
    "celestyal": {"label": "Celestyal", "swatch": "#34302c", "bg": {"solid": [52, 48, 44], "g1": [38, 35, 32], "g2": [64, 58, 52]}, "palette": "warmMediterranean", "defaultHeaderLogoUrl": "celestyal-client-mark.svg"}
  }$themes$::jsonb,
  'Talia UI theme registry',
  'Named UI themes (gradients, palettes, default header logo references). Merged with built-in app defaults on read.',
  true
),
(
  'ui_appearance',
  'theme_asset_overrides',
  jsonb_build_object(
    'celestyal-client-mark.svg',
    $svg$<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" aria-hidden="true">
  <circle cx="36" cy="14" r="5" fill="#d4a574"/>
  <path d="M6 30c6-4 12-4 18 0s12 4 18 0" stroke="#0d9488" stroke-width="2.5" stroke-linecap="round"/>
  <path d="M4 36c8-5 16-5 24 0s16 5 24 0" stroke="#0f766e" stroke-width="2" stroke-linecap="round" opacity="0.88"/>
</svg>$svg$
  ),
  'Talia UI theme assets',
  'Inline SVG or other small asset payloads keyed by filename for themes that reference public paths.',
  true
)
ON CONFLICT (category, setting_key) DO NOTHING;
