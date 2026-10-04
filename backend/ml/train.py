"""Train one LightGBM model per forecast horizon (1, 2 and 3 days ahead).

Compares against two baselines and saves models plus metrics for the API.
Usage:  python -m ml.train  [--test-start 2019-07-01]
"""
import argparse
import json

import lightgbm as lgb
import numpy as np
import pandas as pd
from sklearn.impute import SimpleImputer
from sklearn.linear_model import Ridge
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

from .features import FEATURES, group_of, make_xy
from .paths import DATASET, META, METRICS, HORIZONS, model_path

PARAMS = {
    "objective": "regression_l1",   # robust to the occasional sensor spike
    "learning_rate": 0.03,
    "num_leaves": 31,
    "min_data_in_leaf": 20,
    "feature_fraction": 0.85,
    "bagging_fraction": 0.85,
    "bagging_freq": 1,
    "lambda_l2": 1.0,
    "verbose": -1,
    "seed": 7,
}

# Every feature that comes from the satellite fire data
FIRE_COLS = [f for f in FEATURES if f.startswith(("fire_", "frp_"))]

def mae(a, b):
    return float(np.mean(np.abs(np.asarray(a) - np.asarray(b))))


def rmse(a, b):
    return float(np.sqrt(np.mean((np.asarray(a) - np.asarray(b)) ** 2)))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--test-start", default="2019-07-01",
                    help="first date of the held-out test period (includes the 2019 stubble season)")
    args = ap.parse_args()

    if not DATASET.exists():
        raise SystemExit("Missing dataset. Run `python -m ml.build_dataset` first.")
    df = pd.read_csv(DATASET, parse_dates=["date"]).set_index("date").asfreq("D")
    meta = json.loads(META.read_text()) if META.exists() else {"source": "unknown"}
    test_start = pd.Timestamp(args.test_start)

    results = {"baseline": {}, "ridge": {}, "lightgbm": {}}
    season_results = {"baseline": {}, "lightgbm": {}}
    intervals, contrib_abs = {}, []
    ablation = {"all": {}, "season": {}}
    for h in HORIZONS:
        X, y = make_xy(df, h)
        ok = y.notna() & X["aqi_lag0"].notna()
        X, y = X[ok], y[ok]
        train = X.index < test_start
        X_tr, y_tr, X_te, y_te = X[train], y[train], X[~train], y[~train]
        if len(X_te) < 30:
            raise SystemExit("Test period is too short. Use an earlier --test-start.")

        # Baseline: tomorrow will be like today
        base_pred = X_te["aqi_lag0"]

        # Ridge regression (linear)
        ridge = make_pipeline(SimpleImputer(strategy="median"), StandardScaler(), Ridge(alpha=3.0))
        ridge.fit(X_tr, y_tr)
        ridge_pred = ridge.predict(X_te)

        # LightGBM with early stopping on the last 20% of the training period
        cut = int(len(X_tr) * 0.8)
        dtrain = lgb.Dataset(X_tr.iloc[:cut], y_tr.iloc[:cut])
        dvalid = lgb.Dataset(X_tr.iloc[cut:], y_tr.iloc[cut:])
        probe = lgb.train(PARAMS, dtrain, num_boost_round=3000, valid_sets=[dvalid],
                          callbacks=[lgb.early_stopping(150, verbose=False)])
        best = max(probe.best_iteration, 100)
        model = lgb.train(PARAMS, lgb.Dataset(X_tr, y_tr), num_boost_round=best)
        pred = model.predict(X_te)
        model.save_model(str(model_path(h)))
        
        # Ablation study: the same model trained without any fire features
        keep = [c for c in FEATURES if c not in FIRE_COLS]
        no_fire = lgb.train(PARAMS, lgb.Dataset(X_tr[keep], y_tr), num_boost_round=best)
        pred_nf = no_fire.predict(X_te[keep])

        for name, p in (("baseline", base_pred), ("ridge", ridge_pred), ("lightgbm", pred)):
            results[name][h] = {"mae": round(mae(y_te, p), 2), "rmse": round(rmse(y_te, p), 2)}

        # Ablation study: the same model trained without any fire features
        ablation["all"][h] = {"mae": round(mae(y_te, pred_nf), 2), "rmse": round(rmse(y_te, pred_nf), 2)}

        # Stubble-burning season inside the test period (15 Oct .. 30 Nov)
        doy = X_te.index.dayofyear
        season = (doy >= 288) & (doy <= 334)
        if season.sum() >= 10:
            season_results["baseline"][h] = round(mae(y_te[season], base_pred[season]), 2)
            season_results["lightgbm"][h] = round(mae(y_te[season], pred[season]), 2)

        ablation["all"][h] = {"with_fires": round(mae(y_te, pred), 2),
                              "without_fires": round(mae(y_te, pred_nf), 2)}
        if season.sum() >= 10:
            ablation["season"][h] = {"with_fires": round(mae(y_te[season], pred[season]), 2),
                                     "without_fires": round(mae(y_te[season], pred_nf[season]), 2)}
        print(f"     without fire data: MAE {ablation['all'][h]['without_fires']:.1f}")
        # Uncertainty band from test residuals
        resid = y_te.values - pred
        intervals[h] = [round(float(np.percentile(resid, 10)), 1), round(float(np.percentile(resid, 90)), 1)]

        # SHAP values (TreeSHAP built into LightGBM)
        contrib = model.predict(X_te, pred_contrib=True)[:, :-1]
        contrib_abs.append(np.abs(contrib).mean(axis=0))

        print(f"h={h}: baseline MAE {results['baseline'][h]['mae']:.1f} | "
              f"ridge {results['ridge'][h]['mae']:.1f} | lightgbm {results['lightgbm'][h]['mae']:.1f} "
              f"({best} trees)")

    mean_abs = np.mean(contrib_abs, axis=0)
    groups = {}
    for f, v in zip(FEATURES, mean_abs):
        groups[group_of(f)] = groups.get(group_of(f), 0.0) + float(v)
    total = sum(groups.values()) or 1.0
    importance = sorted(({"factor": k, "share": round(v / total, 3)} for k, v in groups.items()),
                        key=lambda d: -d["share"])
    top_features = sorted(zip(FEATURES, mean_abs.round(2).tolist()), key=lambda t: -t[1])[:8]

    def avg(d):
        return round(float(np.mean([v["mae"] for v in d.values()])), 2)
    
    def summarize(part):
        if not ablation[part]:
            return None
        w = float(np.mean([v["with_fires"] for v in ablation[part].values()]))
        wo = float(np.mean([v["without_fires"] for v in ablation[part].values()]))
        return {"with_fires": round(w, 2), "without_fires": round(wo, 2),
                "improvement_pct": round((wo - w) / wo * 100, 1) if wo else None}

    fire_ablation = {"all_year": summarize("all"), "stubble_season": summarize("season")}
    print(f"Fire data ablation: {fire_ablation}")
    metrics = {
        "intervals": {str(h): v for h, v in intervals.items()},
        "fire_ablation": fire_ablation,
        "data_source": meta.get("source", "unknown"),
        "test_start": test_start.strftime("%Y-%m-%d"),
        "test_end": df.index.max().strftime("%Y-%m-%d"),
        "horizons": {str(h): {m: results[m][h] for m in results} for h in HORIZONS},
        "models": [
            {"name": "Naive baseline", "detail": "Tomorrow is the same as today", "mae": avg(results["baseline"])},
            {"name": "Ridge regression", "detail": "Linear model on the same features", "mae": avg(results["ridge"])},
            {"name": "LightGBM", "detail": "Gradient boosting, the model in use", "mae": avg(results["lightgbm"]), "chosen": True},
        ],
        "stubble_season_mae": {m: {str(h): v for h, v in d.items()} for m, d in season_results.items()},
        "intervals": {str(h): v for h, v in intervals.items()},
        "importance": importance,
        "top_features": [{"feature": f, "mean_abs_shap": v} for f, v in top_features],
        "features": FEATURES,
    }
    METRICS.write_text(json.dumps(metrics, indent=2))
    print(f"Saved models and {METRICS}")


if __name__ == "__main__":
    main()
