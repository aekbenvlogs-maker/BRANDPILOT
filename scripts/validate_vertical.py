#!/usr/bin/env python3
# ============================================================
# PROJECT      : BRANDSCALE — AI Brand Scaling Tool
# FILE         : scripts/validate_vertical.py
# DESCRIPTION  : Validates a vertical YAML configuration file
#                Checks schema, weight sums, thresholds, required fields.
# USAGE        : python scripts/validate_vertical.py <vertical_name>
#                e.g. python scripts/validate_vertical.py rh
# ============================================================

from __future__ import annotations

import sys
from pathlib import Path
from typing import Any

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
SUPPORTED_VERTICALS = ["generic", "rh", "immo", "compta", "formation", "esn"]
REQUIRED_WEIGHT_KEYS = {"sector", "company_size", "engagement", "source"}
REQUIRED_THRESHOLD_KEYS = {"hot", "warm", "cold"}
WEIGHT_SUM_TOLERANCE = 0.001


def _load_yaml(path: Path) -> dict[str, Any]:
    """Load a YAML file. Raises if missing or invalid."""
    try:
        import yaml
    except ImportError:
        print("❌ pyyaml not installed — run: pip install pyyaml")
        sys.exit(1)

    if not path.exists():
        print(f"❌ YAML file not found: {path}")
        sys.exit(1)

    with path.open(encoding="utf-8") as f:
        data = yaml.safe_load(f)

    if not isinstance(data, dict):
        print(f"❌ YAML root must be a mapping (dict), got {type(data).__name__}")
        sys.exit(1)

    return data


def validate_meta(config: dict, vertical: str) -> list[str]:
    """Validate the meta section."""
    errors: list[str] = []
    meta = config.get("meta")
    if not meta:
        errors.append("Missing required section: 'meta'")
        return errors
    if not meta.get("name"):
        errors.append("meta.name is required")
    if not meta.get("label"):
        errors.append("meta.label is required")
    if not meta.get("version"):
        errors.append("meta.version is required")
    return errors


def validate_scoring(config: dict) -> list[str]:
    """Validate scoring weights and thresholds."""
    errors: list[str] = []
    scoring = config.get("scoring")
    if not scoring:
        errors.append("Missing required section: 'scoring'")
        return errors

    # --- Weights ---
    weights = scoring.get("weights")
    if not weights:
        errors.append("scoring.weights is required")
    else:
        missing_w = REQUIRED_WEIGHT_KEYS - set(weights.keys())
        if missing_w:
            errors.append(f"scoring.weights missing keys: {missing_w}")
        else:
            weight_sum = sum(weights.values())
            if abs(weight_sum - 1.0) > WEIGHT_SUM_TOLERANCE:
                errors.append(
                    f"scoring.weights must sum to 1.0 "
                    f"(got {weight_sum:.4f}, delta={abs(weight_sum - 1.0):.4f})"
                )
            for k, v in weights.items():
                if not isinstance(v, (int, float)) or v < 0 or v > 1:
                    errors.append(f"scoring.weights.{k} must be a float in [0, 1]")

    # --- Thresholds ---
    thresholds = scoring.get("thresholds")
    if not thresholds:
        errors.append("scoring.thresholds is required")
    else:
        missing_t = REQUIRED_THRESHOLD_KEYS - set(thresholds.keys())
        if missing_t:
            errors.append(f"scoring.thresholds missing keys: {missing_t}")
        else:
            hot = thresholds.get("hot", 0)
            warm = thresholds.get("warm", 0)
            cold = thresholds.get("cold", 0)
            if not (hot > warm >= cold):
                errors.append(
                    f"scoring.thresholds must satisfy: hot > warm >= cold "
                    f"(got hot={hot}, warm={warm}, cold={cold})"
                )

    return errors


def validate_custom_fields(config: dict) -> list[str]:
    """Validate custom_fields entries."""
    errors: list[str] = []
    fields = config.get("custom_fields", [])
    if not isinstance(fields, list):
        errors.append("custom_fields must be a list")
        return errors
    for i, field in enumerate(fields):
        if not isinstance(field, dict):
            errors.append(f"custom_fields[{i}] must be a mapping")
            continue
        if not field.get("name"):
            errors.append(f"custom_fields[{i}].name is required")
        if not field.get("label"):
            errors.append(f"custom_fields[{i}].label is required")
        if not field.get("type"):
            errors.append(f"custom_fields[{i}].type is required")
        score_map = field.get("score_map", {})
        if not isinstance(score_map, dict):
            errors.append(f"custom_fields[{i}].score_map must be a mapping")
    return errors


def validate_email_sequences(config: dict) -> list[str]:
    """Validate email sequences (cold/warm/hot mandatory)."""
    errors: list[str] = []
    email = config.get("email")
    if not email:
        errors.append("Missing required section: 'email'")
        return errors
    sequences = email.get("sequences")
    if not sequences:
        errors.append("email.sequences is required")
        return errors
    for seq_name in ["cold", "warm", "hot"]:
        seq = sequences.get(seq_name)
        if not seq:
            errors.append(f"email.sequences.{seq_name} is required")
        elif not seq.get("subject"):
            errors.append(f"email.sequences.{seq_name}.subject is required")
        elif not seq.get("interval_days"):
            errors.append(f"email.sequences.{seq_name}.interval_days is required")
    return errors


def validate_seasonal_triggers(config: dict) -> list[str]:
    """Validate seasonal_triggers entries."""
    errors: list[str] = []
    triggers = config.get("seasonal_triggers", [])
    if not isinstance(triggers, list):
        errors.append("seasonal_triggers must be a list")
        return errors
    for i, trigger in enumerate(triggers):
        if not isinstance(trigger, dict):
            errors.append(f"seasonal_triggers[{i}] must be a mapping")
            continue
        month = trigger.get("month")
        if month is None:
            errors.append(f"seasonal_triggers[{i}].month is required")
        elif not isinstance(month, int) or not (1 <= month <= 12):
            errors.append(
                f"seasonal_triggers[{i}].month must be an integer between 1 and 12 "
                f"(got {month!r})"
            )
        if not trigger.get("label"):
            errors.append(f"seasonal_triggers[{i}].label is required")
    return errors


def validate_ai(config: dict) -> list[str]:
    """Validate the ai section."""
    errors: list[str] = []
    ai = config.get("ai")
    if not ai:
        errors.append("Missing required section: 'ai'")
        return errors
    if not ai.get("tone"):
        errors.append("ai.tone is required")
    if "system_prompt_suffix" not in ai:
        errors.append("ai.system_prompt_suffix is required (can be empty string)")
    return errors


def validate_vertical(vertical: str) -> bool:
    """
    Full validation of a vertical YAML configuration.

    Returns True if valid, False otherwise.
    Prints a detailed report to stdout.
    """
    if vertical not in SUPPORTED_VERTICALS:
        print(
            f"❌ Unsupported vertical: '{vertical}'\n"
            f"   Supported: {', '.join(SUPPORTED_VERTICALS)}"
        )
        return False

    yaml_path = (
        Path(__file__).parent.parent / "verticals" / vertical / "vertical.yaml"
    )

    config = _load_yaml(yaml_path)

    all_errors: list[str] = []
    all_errors.extend(validate_meta(config, vertical))
    all_errors.extend(validate_scoring(config))
    all_errors.extend(validate_custom_fields(config))
    all_errors.extend(validate_email_sequences(config))
    all_errors.extend(validate_seasonal_triggers(config))
    all_errors.extend(validate_ai(config))

    if all_errors:
        print(f"❌ Vertical '{vertical}' INVALID — {len(all_errors)} error(s):")
        for err in all_errors:
            print(f"   • {err}")
        return False

    # --- Success summary ---
    meta = config["meta"]
    scoring = config["scoring"]
    weights = scoring["weights"]
    thresholds = scoring["thresholds"]
    custom_fields = config.get("custom_fields", [])
    seasonal = config.get("seasonal_triggers", [])
    price = meta.get("price_eur_month")
    price_str = f"€{price}/mois" if price else "gratuit/inclus"

    print(
        f"✅ Vertical '{vertical}' valide — {meta['name']} ({price_str})\n"
        f"   Poids  : sector={weights['sector']:.2f} | "
        f"company_size={weights['company_size']:.2f} | "
        f"engagement={weights['engagement']:.2f} | "
        f"source={weights['source']:.2f} "
        f"[somme={sum(weights.values()):.3f}]\n"
        f"   Seuils : hot≥{thresholds['hot']} | warm≥{thresholds['warm']} | cold≥{thresholds['cold']}\n"
        f"   Custom fields  : {len(custom_fields)}\n"
        f"   Seasonal triggers : {len(seasonal)}"
    )
    return True


def main() -> None:
    """Entry point — parse CLI argument and run validation."""
    if len(sys.argv) < 2:
        print(
            "Usage: python scripts/validate_vertical.py <vertical_name>\n"
            f"       Supported: {', '.join(SUPPORTED_VERTICALS)}\n\n"
            "Example: python scripts/validate_vertical.py rh"
        )
        sys.exit(1)

    vertical = sys.argv[1].lower().strip()
    success = validate_vertical(vertical)
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
