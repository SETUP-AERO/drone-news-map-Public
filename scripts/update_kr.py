#!/usr/bin/env python3
"""Refresh Korean drone company list + regional business counts from droneportal.or.kr.
Usage: python3 -I update_kr.py OUT_DIR
Writes OUT_DIR/kr_companies.json and OUT_DIR/kr_regions.json (documents for the artifact db: meta/kr_companies, meta/kr_regions).
Personal fields on the portal (대표자, 연락처, 이메일) and street addresses are deliberately NOT kept; location is the 시군구 centroid."""
import sys, os, re, html, json, hashlib, math, datetime, subprocess, concurrent.futures as cf
HERE = os.path.dirname(os.path.abspath(__file__)); OUT = sys.argv[1]; os.makedirs(OUT, exist_ok=True)
BASE = "https://droneportal.or.kr"
def get(url):
    r = subprocess.run(["curl", "-sL", "--max-time", "60", url], capture_output=True)
    return r.stdout.decode("utf-8", "ignore")
def text(s):
    s = re.sub(r"<script.*?</script>", "", s, flags=re.S); s = re.sub(r"<style.*?</style>", "", s, flags=re.S)
    return html.unescape(re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", s)))
# 1) regional counts
st = text(get(BASE + "/main/web/contents/M020-05-01"))
m = re.search(r"권역별 세부 현황 \(단위: 개사\) 권역 전체 사업체 제작 활용 전체 합계 ([\d,]+) ([\d,]+) ([\d,]+)(.*?)분야별", st)
if not m: sys.exit("region table not found; page layout changed")
n = lambda x: int(x.replace(",", ""))
C = {"수도권": (37.45, 127.0), "강원권": (37.75, 128.3), "충청권": (36.55, 127.1), "전라권": (35.25, 126.95), "경상권": (35.85, 128.65), "제주권": (33.38, 126.55)}
regions = [{"name": r, "total": n(a), "make": n(b), "use": n(c), "lat": C[r][0], "lon": C[r][1]} for r, a, b, c in re.findall(r"(수도권|강원권|충청권|전라권|경상권|제주권) ([\d,]+) ([\d,]+) ([\d,]+)", m.group(4))]
survey = re.search(r"(\d{4}년 드론산업 실태조사) 기준", st)
reg = {"asOf": (survey.group(1) + " 기준") if survey else "", "source": "드론정보포털 드론통계", "total": n(m.group(1)), "make": n(m.group(2)), "use": n(m.group(3)), "regions": regions}
json.dump(reg, open(os.path.join(OUT, "kr_regions.json"), "w"), ensure_ascii=False)
# 2) company list
ids = sorted(set(re.findall(r"fnDetail\((\d+)\)", get(BASE + "/main/web/drone/makrInfo/list"))), key=int)
LABELS = ["제조사명","대표자","연락처","홈페이지","이메일","소재지","개발제품","기체종류","품목","개발 및 활용분야","정부사업 참여이력","사업분야","제품소개서"]
def detail(i):
    t = text(get(f"{BASE}/main/web/drone/makrInfo/detail?makrSeq={i}"))
    a, b = t.find("프린트 공유 URL"), t.find(" 목록 이용약관")
    if a < 0 or b < 0: return None
    parts = re.split("(" + "|".join(map(re.escape, LABELS)) + r") ", t[a + len("프린트 공유 URL"):b])
    d = {"_id": i}
    for k in range(1, len(parts) - 1, 2): d[parts[k]] = parts[k + 1].strip().strip(",").strip()
    return d
with cf.ThreadPoolExecutor(4) as ex: raw = [r for r in ex.map(detail, ids) if r]
sg = json.load(open(os.path.join(HERE, "sigungu.json")))
SIDO = [("서울",["11"],"서울"),("부산",["26"],"부산"),("대구",["27"],"대구"),("인천",["28"],"인천"),("광주광역",["29"],"광주"),("전남광주",["29","46"],None),("대전",["30"],"대전"),("울산",["31"],"울산"),("세종",["36"],"세종"),("경기",["41"],"경기"),("강원",["42","51"],"강원"),("충북",["43"],"충북"),("충청북",["43"],"충북"),("충남",["44"],"충남"),("충청남",["44"],"충남"),("전북",["45","52"],"전북"),("전라북",["45","52"],"전북"),("전남",["46"],"전남"),("전라남",["46"],"전남"),("경북",["47"],"경북"),("경상북",["47"],"경북"),("경남",["48"],"경남"),("경상남",["48"],"경남"),("제주",["50"],"제주")]
SHORT = {"11":"서울","26":"부산","27":"대구","28":"인천","29":"광주","30":"대전","31":"울산","36":"세종","41":"경기","42":"강원","51":"강원","43":"충북","44":"충남","45":"전북","52":"전북","46":"전남","47":"경북","48":"경남","50":"제주"}
CITY = {"부천시":(37.50,126.78),"고양시":(37.66,126.83),"용인시":(37.24,127.18),"안산시":(37.32,126.83),"청주시":(36.64,127.49),"천안시":(36.81,127.15),"전주시":(35.82,127.11),"포항시":(36.02,129.34),"창원시":(35.23,128.68),"수원시":(37.26,127.03),"성남시":(37.42,127.13),"안양시":(37.39,126.93)}
SIDO_C = {"서울":(37.5665,126.978),"경기":(37.41,127.25),"인천":(37.456,126.705),"부산":(35.18,129.075),"대구":(35.87,128.6),"대전":(36.35,127.385),"광주":(35.16,126.85),"울산":(35.54,129.31)}
REGION = {"서울":"수도권","인천":"수도권","경기":"수도권","강원":"강원권","대전":"충청권","세종":"충청권","충북":"충청권","충남":"충청권","광주":"전라권","전북":"전라권","전남":"전라권","부산":"경상권","대구":"경상권","울산":"경상권","경북":"경상권","경남":"경상권","제주":"제주권"}
def url(u):
    u = (u or "").strip()
    if not u or u == "-" or " " in u: return None
    if u.startswith("http://"): u = "https://" + u[7:]
    return u if u.startswith("https://") else "https://" + u
items, miss = [], []
for r in raw:
    name = r.get("제조사명", "").strip()
    if not name or name.lower() == "test": continue
    an = r.get("소재지", "").replace(" ", "")
    codes = short = None
    for key, cs, sh in SIDO:
        if an.startswith(key): codes, short = cs, sh; break
    best = None
    for c, v in sg.items():
        if codes and not any(c.startswith(x) for x in codes): continue
        nm = v["name"].replace(" ", "")
        if nm in an[:40] and (not best or len(nm) > len(best[1]["name"].replace(" ", ""))): best = (c, v)
    lat = lon = place = None
    if best:
        lat, lon, place = best[1]["lat"], best[1]["lon"], best[1]["name"]; short = short or SHORT.get(best[0][:2])
    else:
        for city, (la, lo) in CITY.items():
            if city in an[:30]: lat, lon, place = la, lo, city; break
        if lat is None and short in SIDO_C: lat, lon = SIDO_C[short]
    if lat is None: miss.append(name); continue
    h = int(hashlib.md5(r["_id"].encode()).hexdigest(), 16); ang = (h % 360) * math.pi / 180; rad = 0.008 + ((h >> 9) % 100) / 100 * 0.025
    desc = r.get("개발 및 활용분야") or ""
    d = {"id": "kr-" + r["_id"], "name": name, "place": " ".join(x for x in [short, place] if x), "lat": round(lat + rad * math.sin(ang), 4), "lon": round(lon + rad * math.cos(ang), 4),
         "segment": r.get("사업분야"), "products": r.get("개발제품"), "airframe": r.get("기체종류"), "desc": (desc[:220] + ("…" if len(desc) > 220 else "")) or None,
         "url": url(r.get("홈페이지")), "region": REGION.get(short), "portal_id": r["_id"]}
    items.append({k: v for k, v in d.items() if v not in (None, "")})
json.dump({"asOf": datetime.date.today().isoformat(), "source": "드론정보포털 드론기업검색 (droneportal.or.kr)", "items": items}, open(os.path.join(OUT, "kr_companies.json"), "w"), ensure_ascii=False)
print(f"regions={len(regions)} total={reg['total']} companies={len(items)} unlocated={len(miss)} {miss[:10]}")
