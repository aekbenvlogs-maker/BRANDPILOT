#!/usr/bin/env python3
"""Phase Finale validation — tests all 6 verticals against executor assertions."""
import os
import sys

# Minimal env for settings loading
os.environ.setdefault("SECRET_KEY", "test-secret-key-min-32-chars-brandscale")
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///./test.db")
os.environ.setdefault("OPENAI_API_KEY", "sk-test")
os.environ.setdefault("FERNET_KEY", "bMeD-rHdvL0fMvdGl5JOB5H6e2TMQ9l8kqfBi1nHrKs=")

import yaml

# Add parent to path
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

failures = []


def test(name, fn):
    try:
        fn()
        print(f"  ✅ {name}")
    except Exception as e:
        print(f"  ❌ {name}: {e}")
        failures.append(name)


# ---- Generic ---------------------------------------------------------------
print("--- VERTICAL=generic ---")
os.environ["VERTICAL"] = "generic"
from configs.settings import get_settings, _load_vertical_config
_load_vertical_config.cache_clear()
get_settings.cache_clear()
s = get_settings()

test("active_vertical == generic", lambda: (
    None if s.active_vertical == "generic" else (_ for _ in ()).throw(AssertionError(f"got {s.active_vertical}"))
))
test("weights sum == 1.0", lambda: (
    None if abs(sum(s.scoring_weights.values()) - 1.0) < 0.001 else (_ for _ in ()).throw(AssertionError(f"sum={sum(s.scoring_weights.values())}"))
))
test("threshold hot=70", lambda: (
    None if s.scoring_thresholds["hot"] == 70 else (_ for _ in ()).throw(AssertionError(f"hot={s.scoring_thresholds['hot']}"))
))

# ---- RH --------------------------------------------------------------------
print("--- VERTICAL=rh ---")
os.environ["VERTICAL"] = "rh"
_load_vertical_config.cache_clear()
get_settings.cache_clear()
s = get_settings()

test("active_vertical == rh", lambda: None if s.active_vertical == "rh" else (_ for _ in ()).throw(AssertionError()))
test("engagement == 0.40", lambda: None if s.scoring_weights["engagement"] == 0.40 else (_ for _ in ()).throw(AssertionError(f"got {s.scoring_weights['engagement']}")))
test("hot == 62", lambda: None if s.scoring_thresholds["hot"] == 62 else (_ for _ in ()).throw(AssertionError(f"hot={s.scoring_thresholds['hot']}")))
test("meta.name == BRANDSCALE RH", lambda: None if s.vertical_config["meta"]["name"] == "BRANDSCALE RH" else (_ for _ in ()).throw(AssertionError()))
test("4 custom_fields", lambda: None if len(s.vertical_config["custom_fields"]) == 4 else (_ for _ in ()).throw(AssertionError(f"got {len(s.vertical_config['custom_fields'])}")))

# ---- IMMO ------------------------------------------------------------------
print("--- VERTICAL=immo ---")
os.environ["VERTICAL"] = "immo"
_load_vertical_config.cache_clear()
get_settings.cache_clear()
s = get_settings()

test("engagement == 0.50", lambda: None if s.scoring_weights["engagement"] == 0.50 else (_ for _ in ()).throw(AssertionError(f"got {s.scoring_weights['engagement']}")))
test("source == 0.35", lambda: None if s.scoring_weights["source"] == 0.35 else (_ for _ in ()).throw(AssertionError(f"got {s.scoring_weights['source']}")))
test("weights sum == 1.0", lambda: None if abs(sum(s.scoring_weights.values()) - 1.0) < 0.001 else (_ for _ in ()).throw(AssertionError()))

# ---- COMPTA ----------------------------------------------------------------
print("--- VERTICAL=compta ---")
os.environ["VERTICAL"] = "compta"
_load_vertical_config.cache_clear()
get_settings.cache_clear()
s = get_settings()
compta_cfg = yaml.safe_load(open("verticals/compta/vertical.yaml"))

test("company_size == 0.35", lambda: None if s.scoring_weights["company_size"] == 0.35 else (_ for _ in ()).throw(AssertionError(f"got {s.scoring_weights['company_size']}")))
months_c = [t["month"] for t in compta_cfg.get("seasonal_triggers", [])]
test("seasonal months 3,6,12", lambda: None if (3 in months_c and 6 in months_c and 12 in months_c) else (_ for _ in ()).throw(AssertionError(f"months={months_c}")))

# ---- FORMATION -------------------------------------------------------------
print("--- VERTICAL=formation ---")
os.environ["VERTICAL"] = "formation"
_load_vertical_config.cache_clear()
get_settings.cache_clear()
s = get_settings()
formation_cfg = yaml.safe_load(open("verticals/formation/vertical.yaml"))

test("engagement == 0.45", lambda: None if s.scoring_weights["engagement"] == 0.45 else (_ for _ in ()).throw(AssertionError(f"got {s.scoring_weights['engagement']}")))
opco_score = s.vertical_config["custom_fields"][0]["score_map"].get("OPCO")
test("OPCO score_map == 100", lambda: None if opco_score == 100 else (_ for _ in ()).throw(AssertionError(f"OPCO={opco_score}")))
months_f = [t["month"] for t in formation_cfg.get("seasonal_triggers", [])]
test("seasonal months 1,9,11", lambda: None if (1 in months_f and 9 in months_f and 11 in months_f) else (_ for _ in ()).throw(AssertionError(f"months={months_f}")))

# ---- ESN -------------------------------------------------------------------
print("--- VERTICAL=esn ---")
os.environ["VERTICAL"] = "esn"
_load_vertical_config.cache_clear()
get_settings.cache_clear()
s = get_settings()
esn_cfg = yaml.safe_load(open("verticals/esn/vertical.yaml"))

test("sector == 0.30", lambda: None if s.scoring_weights["sector"] == 0.30 else (_ for _ in ()).throw(AssertionError(f"got {s.scoring_weights['sector']}")))
test("company_size == 0.30", lambda: None if s.scoring_weights["company_size"] == 0.30 else (_ for _ in ()).throw(AssertionError(f"got {s.scoring_weights['company_size']}")))
test("hot == 65", lambda: None if s.scoring_thresholds["hot"] == 65 else (_ for _ in ()).throw(AssertionError(f"hot={s.scoring_thresholds['hot']}")))
months_e = [t["month"] for t in esn_cfg.get("seasonal_triggers", [])]
test("seasonal months 10,1", lambda: None if (10 in months_e and 1 in months_e) else (_ for _ in ()).throw(AssertionError(f"months={months_e}")))

# ---- Scoring service zero-regression ---------------------------------------
print("--- Scoring service zero-regression ---")
os.environ["VERTICAL"] = "generic"
_load_vertical_config.cache_clear()
get_settings.cache_clear()
from microservices.bs_scoring.service import score_lead, classify_tier, explain_score

lead = {"sector": "saas", "company_size": "enterprise", "email_opens": 5, "email_clicks": 2, "page_visits": 3, "source": "referral"}
score = score_lead(lead)
tier = classify_tier(score)
expl = explain_score(lead)
test("score in [0,100]", lambda: None if 0 <= score <= 100 else (_ for _ in ()).throw(AssertionError(f"score={score}")))
test("tier valid", lambda: None if tier in ("hot", "warm", "cold") else (_ for _ in ()).throw(AssertionError(f"tier={tier}")))
test("explain_score weights sum", lambda: None if abs(sum(expl["weights"].values()) - 1.0) < 0.001 else (_ for _ in ()).throw(AssertionError()))

# ---- Final report ----------------------------------------------------------
print()
if failures:
    print(f"❌ {len(failures)} test(s) FAILED: {failures}")
    sys.exit(1)
else:
    print("✅ Toutes les assertions Phase Finale passées — BRANDSCALE MULTIVERSAL prêt ✅")
    sys.exit(0)
