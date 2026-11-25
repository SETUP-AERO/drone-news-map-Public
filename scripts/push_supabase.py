#!/usr/bin/env python3
"""Write data into the Supabase database with the service role key.
The key is read from the environment and never stored in the repository.

  SUPABASE_URL=https://xxxx.supabase.co SUPABASE_SERVICE_KEY=... \
  python3 -I scripts/push_supabase.py news NEWS.json      # upsert news rows, prune items older than 45 days
  python3 -I scripts/push_supabase.py kr OUT_DIR          # load kr_companies.json + kr_regions.json from update_kr.py

NEWS.json is a list of objects with: id, title, title_en, title_ko, source, url (https), published (ISO 8601),
place, country (Korean name), country_en, lat, lon, category (defense|commercial|uam|policy|business|conflict), lang."""
import sys, os, json, subprocess, datetime, urllib.parse

URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
if not URL or not KEY:
    sys.exit("Set SUPABASE_URL and SUPABASE_SERVICE_KEY in the environment.")

def call(method, path, body=None, prefer=None):
    cmd = ["curl", "-sS", "--max-time", "60", "-X", method, f"{URL}/rest/v1/{path}",
           "-H", f"apikey: {KEY}", "-H", f"Authorization: Bearer {KEY}", "-H", "Content-Type: application/json",
           "-w", "\n%{http_code}"]
    if prefer: cmd += ["-H", f"Prefer: {prefer}"]
    if body is not None: cmd += ["--data-binary", "@-"]
    r = subprocess.run(cmd, input=json.dumps(body, ensure_ascii=False).encode() if body is not None else None, capture_output=True)
    out = r.stdout.decode("utf-8", "ignore"); text, _, code = out.rpartition("\n")
    if not code.startswith("2"):
        sys.exit(f"{method} {path} failed: HTTP {code} {text[:300]} {r.stderr.decode()[:200]}")
    return json.loads(text) if text.strip() else None

def upsert(table, rows, key):
    for i in range(0, len(rows), 500):
        call("POST", f"{table}?on_conflict={key}", rows[i:i+500], "resolution=merge-duplicates,return=minimal")

def set_meta(key, value):
    upsert("meta", [{"key": key, "value": value, "updated_at": datetime.datetime.now(datetime.timezone.utc).isoformat()}], "key")

NEWS_COLS = ["id","title","title_en","title_ko","source","url","published","place","country","country_en","lat","lon","category","lang"]
CO_COLS = ["id","kind","name","name_ko","place","country","lat","lon","segment","segment_en","founded","products","products_en","airframe","type","type_en","desc","desc_en","url","region","portal_id","source","as_of"]
CATS = {"defense","commercial","uam","policy","business","conflict"}

def news(path):
    items = json.load(open(path))
    rows = []
    for n in items:
        if n.get("category") not in CATS or not str(n.get("url") or "https://").startswith("https://"): continue
        rows.append({c: n.get(c) for c in NEWS_COLS})
    if rows: upsert("news", rows, "id")
    cutoff = (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=45)).strftime("%Y-%m-%dT%H:%M:%SZ")
    call("DELETE", f"news?published=lt.{cutoff}", prefer="return=minimal")
    set_meta("status", {"updatedAt": datetime.datetime.now(datetime.timezone.utc).isoformat()})
    print(f"news upserted={len(rows)} skipped={len(items)-len(rows)}")

def kr(out_dir):
    cos = json.load(open(os.path.join(out_dir, "kr_companies.json")))
    reg = json.load(open(os.path.join(out_dir, "kr_regions.json")))
    rows = [{c: dict(it, kind="portal", country="대한민국", source=cos.get("source"), as_of=cos.get("asOf")).get(c) for c in CO_COLS} for it in cos["items"]]
    if len(rows) < 50: sys.exit(f"only {len(rows)} firms scraped; refusing to replace the list")
    upsert("companies", rows, "id")
    keep = ",".join('"' + r["id"].replace('"', '') + '"' for r in rows)
    call("DELETE", "companies?kind=eq.portal&id=not.in." + urllib.parse.quote(f"({keep})", safe=""), prefer="return=minimal")
    upsert("regions", [dict(r, as_of=reg.get("asOf"), source=reg.get("source")) for r in reg["regions"]], "name")
    set_meta("kr_totals", {"total": reg["total"], "make": reg["make"], "use": reg["use"], "asOf": reg.get("asOf")})
    print(f"portal firms={len(rows)} regions={len(reg['regions'])} total={reg['total']}")

if __name__ == "__main__":
    if len(sys.argv) != 3 or sys.argv[1] not in ("news", "kr"): sys.exit(__doc__)
    {"news": news, "kr": kr}[sys.argv[1]](sys.argv[2])
