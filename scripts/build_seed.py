#!/usr/bin/env python3
"""Build supabase/seed.sql from exported JSON (news/, companies/, meta/ folders).
Usage: python3 -I scripts/build_seed.py EXPORT_DIR > supabase/seed.sql"""
import sys, os, json, glob
E = sys.argv[1]
def q(v):
    if v is None or v == "": return "null"
    if isinstance(v, bool): return "true" if v else "false"
    if isinstance(v, (int, float)): return repr(v)
    return "'" + str(v).replace("'", "''") + "'"
def upsert(table, cols, rows, key="id"):
    if not rows: return ""
    vals = ",\n".join("(" + ",".join(q(r.get(c)) for c in cols) + ")" for r in rows)
    qc = ",".join('"desc"' if c == "desc" else c for c in cols)
    upd = ",".join(f'{"\"desc\"" if c=="desc" else c}=excluded.{"\"desc\"" if c=="desc" else c}' for c in cols if c != key)
    return f"insert into public.{table} ({qc}) values\n{vals}\non conflict ({key}) do update set {upd};\n\n"
out = ["-- Seed data exported from the first version of the map. Safe to run more than once.\n"]
news = []
for f in sorted(glob.glob(os.path.join(E, "news", "*.json"))):
    d = json.load(open(f)); d["id"] = os.path.basename(f)[:-5]; news.append(d)
NC = ["id","title","title_en","title_ko","source","url","published","place","country","country_en","lat","lon","category","lang"]
out.append(upsert("news", NC, news))
cos = []
for f in sorted(glob.glob(os.path.join(E, "companies", "*.json"))):
    d = json.load(open(f)); d["id"] = os.path.basename(f)[:-5]; d.setdefault("kind", "major"); cos.append(d)
kr = json.load(open(os.path.join(E, "meta", "kr_companies.json")))
for it in kr["items"]:
    d = dict(it); d["kind"] = "portal"; d["country"] = "대한민국"; d["source"] = kr.get("source"); d["as_of"] = kr.get("asOf"); cos.append(d)
CC = ["id","kind","name","name_ko","place","country","lat","lon","segment","segment_en","founded","products","products_en","airframe","type","type_en","desc","desc_en","url","region","portal_id","source","as_of"]
for i in range(0, len(cos), 100): out.append(upsert("companies", CC, cos[i:i+100]))
rg = json.load(open(os.path.join(E, "meta", "kr_regions.json")))
rows = [dict(r, as_of=rg.get("asOf"), source=rg.get("source")) for r in rg["regions"]]
out.append(upsert("regions", ["name","total","make","use","lat","lon","as_of","source"], rows, key="name"))
out.append("insert into public.meta (key, value) values ('kr_totals', " + q(json.dumps({"total": rg["total"], "make": rg["make"], "use": rg["use"], "asOf": rg.get("asOf")}, ensure_ascii=False)) + "::jsonb) on conflict (key) do update set value = excluded.value, updated_at = now();\n")
out.append("insert into public.meta (key, value) values ('status', jsonb_build_object('updatedAt', now())) on conflict (key) do update set value = excluded.value, updated_at = now();\n")
sys.stdout.write("".join(out))
