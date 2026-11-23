#!/usr/bin/env python3
"""science.driver_analysis.v0 — peerset / prior / decision moments / value.

Discrete Python element. Returns Evidence JSON only.
Must NOT invent Finding score or recommended_action.
"""
from __future__ import annotations

import json
import math
import statistics
import sys
import uuid
from typing import Any

TASK_ID = "science.driver_analysis.v0"
METHOD_VERSION = "0.1.0"
DEFAULT_YIELD = 850.0
CURRENCY = "EUR"


def _num(value: Any, default: float = 0.0) -> float:
    try:
        if value is None:
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def _month(iso: str | None) -> int | None:
    if not iso or len(str(iso)) < 7:
        return None
    try:
        return int(str(iso)[5:7])
    except ValueError:
        return None


def _season(iso: str | None) -> str | None:
    m = _month(iso)
    if m is None:
        return None
    year = str(iso)[:4]
    if m in (12, 1, 2):
        return f"{year}-winter"
    if m in (3, 4, 5):
        return f"{year}-spring"
    if m in (6, 7, 8):
        return f"{year}-summer"
    return f"{year}-autumn"


def _mean(values: list[float], default: float = 0.0) -> float:
    return statistics.fmean(values) if values else default


def _stdev(values: list[float]) -> float:
    if len(values) < 2:
        return 0.0
    return statistics.pstdev(values)


def _clamp(v: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, v))


def _pearson(xs: list[float], ys: list[float]) -> float | None:
    if len(xs) != len(ys) or len(xs) < 3:
        return None
    mx, my = _mean(xs), _mean(ys)
    num = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    denx = math.sqrt(sum((x - mx) ** 2 for x in xs))
    deny = math.sqrt(sum((y - my) ** 2 for y in ys))
    if denx == 0 or deny == 0:
        return None
    return num / (denx * deny)


def _capacity(row: dict) -> float:
    cabins = _num(row.get("total_cabins"), 0.0)
    if cabins > 0:
        return cabins * 2.0  # berth proxy
    return max(_num(row.get("capacity_guests"), 400.0), 1.0)


def _end_lf(row: dict) -> float:
    if row.get("end_lf") is not None:
        return _clamp(_num(row.get("end_lf")))
    occ = _num(row.get("occupied_cabins"))
    total = _num(row.get("total_cabins"))
    if total > 0:
        return _clamp(occ / total)
    return _clamp(_num(row.get("load_factor")))


def _cluster_key(row: dict) -> str:
    ship = str(row.get("ship_code") or "UNK")
    season = _season(row.get("sail_date_from")) or "unknown"
    return f"{ship}|{season}"


def _pace_curve(mean_lf: float, band: float) -> list[dict]:
    # Simple concave booking build toward end LF.
    weeks = [26, 20, 16, 12, 8, 4, 2, 0]
    curve = []
    for w in weeks:
        frac = 1.0 - (w / 26.0) ** 0.85
        lf = _clamp(mean_lf * frac)
        curve.append({
            "weeks_until_sailing": w,
            "lf": round(lf, 4),
            "band_low": round(_clamp(lf - band), 4),
            "band_high": round(_clamp(lf + band), 4),
        })
    return curve


def _prior_lf_at(curve: list[dict], weeks: float) -> float:
    if not curve:
        return 0.0
    ordered = sorted(curve, key=lambda p: p["weeks_until_sailing"], reverse=True)
    for point in ordered:
        if weeks >= point["weeks_until_sailing"]:
            return _num(point["lf"])
    return _num(ordered[-1]["lf"])


def build_peerset(subject: dict, historic: list[dict]) -> dict:
    key = _cluster_key(subject)
    members = []
    for row in historic:
        if str(row.get("sail_code")) == str(subject.get("sail_code")):
            continue
        if _cluster_key(row) != key:
            continue
        members.append({
            "sail_code": str(row.get("sail_code")),
            "weight": 1.0,
            "in_reason": f"same ship×season cluster ({key})",
            "ship_code": row.get("ship_code"),
            "sail_date_from": row.get("sail_date_from"),
            "end_lf": round(_end_lf(row), 4),
        })
    # Fallback: same ship only
    if len(members) < 2:
        ship = str(subject.get("ship_code") or "")
        members = []
        for row in historic:
            if str(row.get("sail_code")) == str(subject.get("sail_code")):
                continue
            if ship and str(row.get("ship_code") or "") != ship:
                continue
            members.append({
                "sail_code": str(row.get("sail_code")),
                "weight": 0.75,
                "in_reason": "fallback same-ship peerset",
                "ship_code": row.get("ship_code"),
                "sail_date_from": row.get("sail_date_from"),
                "end_lf": round(_end_lf(row), 4),
            })
    members = members[:12]
    manual = subject.get("manual_peer_sail_code")
    manual_vs = None
    if manual:
        learned_ids = {m["sail_code"] for m in members}
        manual_vs = {
            "manual_peer_sail_code": manual,
            "in_learned_peerset": manual in learned_ids,
            "note": "Compare profile_model_map / lazy YoY peer to learned cluster",
        }
    return {
        "cluster_id": key,
        "members": members,
        "n": len(members),
        "selection": "constrained_ship_season_cluster",
        "manual_peer_sail_code": manual,
        "manual_vs_learned": manual_vs,
    }


def build_prior(peerset: dict, historic_by_code: dict[str, dict], subject: dict) -> dict:
    lfs = []
    for member in peerset["members"]:
        row = historic_by_code.get(member["sail_code"])
        if row:
            lfs.append(_end_lf(row))
    mean_lf = _mean(lfs, _end_lf(subject) or 0.65)
    # Shrink thin peers toward global historic mean
    global_lfs = [_end_lf(r) for r in historic_by_code.values()]
    global_mean = _mean(global_lfs, mean_lf)
    n = len(lfs)
    shrink = n / (n + 3) if n else 0.0
    mean_lf = shrink * mean_lf + (1 - shrink) * global_mean
    band = max(_stdev(lfs) if lfs else 0.08, 0.05)
    yield_pg = _num(subject.get("yield_per_guest"), DEFAULT_YIELD)
    capacity = _capacity(subject)
    return {
        "pace": {
            "mean_lf": round(mean_lf, 4),
            "band_low": round(_clamp(mean_lf - band), 4),
            "band_high": round(_clamp(mean_lf + band), 4),
            "curve": _pace_curve(mean_lf, band * 0.6),
        },
        "revenue": {
            "mean_yield_per_guest": round(yield_pg, 2),
            "implied_end_revenue": round(mean_lf * capacity * yield_pg, 2),
            "currency": CURRENCY,
        },
    }


def decision_moments(subject: dict, prior: dict, capacity: float, yield_pg: float) -> list[dict]:
    curve = prior["pace"]["curve"]
    end_lf = _end_lf(subject)
    moments = []
    # Reconstruct a simple actual path that ends at observed LF
    checkpoints = [20, 12, 8, 4]
    for w in checkpoints:
        prior_lf = _prior_lf_at(curve, w)
        # Assume actual lagged when final underperformed prior (or led when over)
        path_frac = 1.0 - (w / 26.0) ** 0.85
        actual_lf = _clamp(end_lf * path_frac)
        gap = prior_lf - actual_lf
        if abs(gap) < 0.04:
            continue
        guests = round(gap * capacity, 1)
        rev = round(guests * yield_pg, 2)
        posture = "pace_soft" if gap > 0 else "pace_hot"
        alternate = (
            "tighten_inventory_or_stimulate_demand"
            if gap > 0
            else "protect_yield_review_group_dilution"
        )
        moments.append({
            "weeks_until_sailing": w,
            "when_label": f"W-{w}",
            "posture": posture,
            "actual_lf": round(actual_lf, 4),
            "prior_lf": round(prior_lf, 4),
            "supportable_alternate": alternate,
            "material_delta_guests": guests,
            "revenue_delta": rev,
            "rationale": (
                f"At W-{w}, reconstructed pace was {actual_lf:.0%} vs peerset prior "
                f"{prior_lf:.0%} — a supportable decision window on the booking horizon."
            ),
        })
    return moments


def covariate_ranks(historic: list[dict], subject: dict) -> tuple[list[dict], list[str]]:
    missing = []
    if not any(r.get("price_index") is not None for r in historic):
        missing.append("price_index")
    if not any(r.get("promo_intensity") is not None for r in historic):
        missing.append("promo_intensity")
    if not any(r.get("competitor_pressure") is not None for r in historic):
        missing.append("competitor_pressure")

    # Residual = end_lf - ship-season mean
    by_cluster: dict[str, list[float]] = {}
    for row in historic:
        by_cluster.setdefault(_cluster_key(row), []).append(_end_lf(row))
    cluster_mean = {k: _mean(v) for k, v in by_cluster.items()}

    residuals = []
    features = {
        "price_posture": [],
        "seasonality_month": [],
        "group_load_share": [],
        "weeks_on_sale_proxy": [],
        "competitor_pressure": [],
    }
    for row in historic:
        resid = _end_lf(row) - cluster_mean.get(_cluster_key(row), 0.0)
        residuals.append(resid)
        # Price: use provided index or a synthetic proxy from LF deviation (labelled honesty)
        price = row.get("price_index")
        if price is None:
            price = 1.0 - resid  # confounder demonstration
        features["price_posture"].append(_num(price, 1.0))
        features["seasonality_month"].append(_num(_month(row.get("sail_date_from")), 6) / 12.0)
        features["group_load_share"].append(_num(row.get("group_share"), 0.25))
        features["weeks_on_sale_proxy"].append(_num(row.get("weeks_on_sale"), 40) / 52.0)
        features["competitor_pressure"].append(_num(row.get("competitor_pressure"), 0.5))

    ranks = []
    notes = {
        "price_posture": "Price often looks important but is confounded with seasonality and demand; interpret as association.",
        "seasonality_month": "Calendar seasonality remains after peerset prior in thin clusters.",
        "group_load_share": "Group mix vs FIT — aligns with Groups/MR materialisation risk.",
        "weeks_on_sale_proxy": "Horizon length / open-for-sale duration.",
        "competitor_pressure": "Competitive pressure when present; else neutral placeholder.",
    }
    for name, series in features.items():
        corr = _pearson(series, residuals)
        importance = abs(corr) if corr is not None else 0.05
        # Stability via odd/even fold agreement
        odd_x = series[0::2]
        odd_y = residuals[0::2]
        even_x = series[1::2]
        even_y = residuals[1::2]
        c1 = _pearson(odd_x, odd_y)
        c2 = _pearson(even_x, even_y)
        if c1 is None or c2 is None:
            stability = 0.4
        else:
            stability = _clamp(1.0 - abs(c1 - c2))
        direction = "positive" if (corr or 0) >= 0 else "negative"
        if name == "price_posture" and "price_index" in missing:
            direction = "mixed"
        ranks.append({
            "feature": name,
            "importance": round(importance, 4),
            "direction": direction,
            "stability": round(stability, 4),
            "partial_association": None if corr is None else round(corr, 4),
            "note": notes[name],
        })
    ranks.sort(key=lambda r: r["importance"], reverse=True)
    # Soften price dominance note when it ranks #1 without real price feed
    if ranks and ranks[0]["feature"] == "price_posture" and "price_index" in missing:
        ranks[0]["note"] += " Rank may be inflated without a true published-rate history feed."
    return ranks, missing


def forward_now(subject: dict, prior: dict, capacity: float, yield_pg: float, ranks: list[dict]) -> dict | None:
    if subject.get("horizon") != "forward_now":
        return None
    weeks = _num(subject.get("weeks_until_sailing"), 8)
    observed = _end_lf(subject) if subject.get("end_lf") is not None or subject.get("load_factor") is not None else _num(subject.get("observed_lf"))
    if subject.get("observed_lf") is not None:
        observed = _num(subject.get("observed_lf"))
    prior_lf = _prior_lf_at(prior["pace"]["curve"], weeks)
    gap = prior_lf - observed
    guests = round(gap * capacity, 1)
    rev = round(guests * yield_pg, 2)
    top = [r["feature"] for r in ranks[:3]]
    groups = subject.get("groups_mr_context") or {
        "note": "Groups/MR own the operational forward book; this strip monetises scientific gap vs prior.",
        "requested_guests": subject.get("group_requested"),
        "reserved_guests": subject.get("group_reserved"),
        "talia_mr": subject.get("talia_mr"),
    }
    return {
        "weeks_until_sailing": weeks,
        "observed_lf": round(observed, 4),
        "prior_lf": round(prior_lf, 4),
        "material_at_stake_guests": guests,
        "revenue_at_stake": rev,
        "groups_mr_context": groups,
        "drivers_of_gap": top,
    }


def build_reasons(
    subject: dict,
    peerset: dict,
    material: dict,
    revenue: dict,
    forward: dict | None,
    ranks: list[dict],
) -> list[dict]:
    top = ranks[0]["feature"] if ranks else "peerset_prior"
    historic_euro = abs(_num(revenue.get("amount")))
    forward_euro = abs(_num(forward.get("revenue_at_stake") if forward else 0))
    return [
        {
            "id": "better_prior",
            "statement": "A learned peerset prior is a stronger baseline than a single YoY peer or price-only narrative.",
            "historic_proof": (
                f"Peerset n={peerset.get('n')} for {_cluster_key(subject)}; "
                f"historic material/revenue gap estimated at {material.get('guests_delta')} guests / €{historic_euro:,.0f}."
            ),
            "forward_implication": (
                "Apply the same prior at booking-horizon now so Groups/MR decisions start from evidence, not habit."
            ),
        },
        {
            "id": "decision_windows",
            "statement": "Historics show where and when alternate pace/group/price posture was supportable.",
            "historic_proof": "Decision moments mark weeks-to-departure gaps vs peerset band (association-backed, not causal proof).",
            "forward_implication": f"Open book value at stake ≈ €{forward_euro:,.0f} under the same method.",
        },
        {
            "id": "drivers_not_price_alone",
            "statement": f"Leading residual driver in this run: {top} — price is one candidate among several.",
            "historic_proof": "Covariate ranks use residual LF after peerset prior with fold stability.",
            "forward_implication": "Elevating prior/peerset quality compounds future revenue beyond price-only levers.",
        },
    ]


def analyze_subject(
    subject: dict,
    historic: list[dict],
    as_of: str,
    role: str,
    scope: dict,
) -> dict:
    historic_by_code = {str(r.get("sail_code")): r for r in historic if r.get("sail_code")}
    peerset = build_peerset(subject, historic)
    prior = build_prior(peerset, historic_by_code, subject)
    capacity = _capacity(subject)
    yield_pg = _num(subject.get("yield_per_guest"), DEFAULT_YIELD)
    moments = decision_moments(subject, prior, capacity, yield_pg) if subject.get("horizon") == "historic" else []
    ranks, missing = covariate_ranks(historic, subject)
    forward = forward_now(subject, prior, capacity, yield_pg, ranks)

    end_lf = _end_lf(subject) if subject.get("horizon") == "historic" else _num(
        (forward or {}).get("observed_lf"), _end_lf(subject)
    )
    prior_end = prior["pace"]["mean_lf"]
    lf_delta = round(end_lf - prior_end, 4) if subject.get("horizon") == "historic" else round(
        _num((forward or {}).get("observed_lf")) - _num((forward or {}).get("prior_lf")), 4
    )
    guests_delta = round(lf_delta * capacity, 1)
    if forward and subject.get("horizon") == "forward_now":
        guests_delta = _num(forward.get("material_at_stake_guests"))
        lf_delta = round(_num(forward.get("observed_lf")) - _num(forward.get("prior_lf")), 4)
    revenue_amount = round(guests_delta * yield_pg, 2)
    if forward and subject.get("horizon") == "forward_now":
        revenue_amount = _num(forward.get("revenue_at_stake"))

    material = {
        "guests_delta": guests_delta,
        "lf_delta": lf_delta,
        "cabins_delta": round(guests_delta / 2.0, 1),
        "unit": "guests",
        "label": "vs peerset prior",
    }
    revenue = {
        "amount": revenue_amount,
        "currency": CURRENCY,
        "basis": "yield_x_guests_delta",
        "label": "Materialised € gap vs prior" if subject.get("horizon") == "historic" else "€ at stake vs prior at now",
    }
    reasons = build_reasons(subject, peerset, material, revenue, forward, ranks)

    return {
        "evidence_id": str(uuid.uuid4()),
        "task_id": TASK_ID,
        "method_version": METHOD_VERSION,
        "role": role if role in ("advisory", "source") else "advisory",
        "as_of": as_of,
        "scope": scope,
        "subject": {
            "type": "sailing",
            "id": str(subject.get("sail_code")),
            "ship_code": subject.get("ship_code"),
            "sail_date_from": subject.get("sail_date_from"),
            "horizon": subject.get("horizon") or "historic",
        },
        "peerset": peerset,
        "prior": prior,
        "decision_moments": moments,
        "material_value": material,
        "revenue_value": revenue,
        "covariate_ranks": ranks,
        "forward_now": forward,
        "reasons": reasons,
        "diagnostics": {
            "n_historic": len(historic),
            "n_forward": 1 if subject.get("horizon") == "forward_now" else 0,
            "honesty": (
                "Association-backed counterfactuals and residual ranks — not causal proof. "
                "Use to show where/when better decisions were supportable and value at stake at now."
            ),
            "assumptions": [
                f"Default yield €{DEFAULT_YIELD}/guest when yield_per_guest missing",
                "Capacity ≈ total_cabins×2 when guest capacity missing",
                "Pace curve is a parametric build to peerset mean LF",
            ],
            "missing_features": missing,
        },
    }


def main() -> None:
    raw = sys.stdin.read()
    request = json.loads(raw) if raw.strip() else {}
    payload = request.get("payload") if isinstance(request.get("payload"), dict) else request
    task = request.get("task") or payload.get("task") or TASK_ID
    if task not in (TASK_ID, "driver_analysis", "science.driver_analysis.v0"):
        # Still run if orchestrator sends the canonical task via wrapper
        pass

    historic = payload.get("historic") or []
    subjects = payload.get("subjects") or []
    as_of = payload.get("as_of") or __import__("datetime").datetime.utcnow().isoformat() + "Z"
    role = payload.get("role") or "advisory"
    scope = payload.get("scope") or {"type": "batch", "label": "driver_analysis"}

    if not subjects and historic:
        # Analyse up to a few recent historic + any marked forward
        subjects = []
        for row in historic[:5]:
            s = dict(row)
            s["horizon"] = "historic"
            subjects.append(s)

    artifacts = []
    for subject in subjects:
        artifacts.append(analyze_subject(subject, historic, as_of, role, scope))

    # Portfolio rollup reasons for the business case
    total_rev = sum(_num(a.get("revenue_value", {}).get("amount")) for a in artifacts)
    result = {
        "ok": True,
        "tool": "driver_analysis",
        "task": TASK_ID,
        "method_version": METHOD_VERSION,
        "artifact_count": len(artifacts),
        "portfolio_revenue_value": round(total_rev, 2),
        "artifacts": artifacts,
        # Explicit non-Finding markers
        "score": None,
        "recommended_action": None,
    }
    print(json.dumps(result))


if __name__ == "__main__":
    main()
