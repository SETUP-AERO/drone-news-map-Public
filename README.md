# World Drone News Map

전 세계 드론 뉴스와 드론 기업·연구기관을 한 지도에서 보여 주는 회원제 웹사이트입니다.
화면은 GitHub Pages에서 정적 파일로 제공되고, 회원 가입·로그인과 데이터는 Supabase가 맡습니다.

- 기본 언어는 영어이고 오른쪽 위 버튼으로 한국어로 바꿀 수 있습니다.
- 가입 후 프로필(이름, 소속, 분야)을 등록한 회원만 데이터를 읽을 수 있습니다. 데이터베이스의 행 수준 보안(RLS)이 이를 강제합니다.
- 지도: MapLibre GL + OpenFreeMap 타일 (키 불필요, 무료).

## 폴더 구성

| 경로 | 내용 |
|---|---|
| `index.html`, `assets/` | 사이트 화면 (로그인, 회원 정보 입력, 지도) |
| `assets/config.js` | Supabase 프로젝트 URL과 공개(anon) 키 |
| `supabase/schema.sql` | 테이블, 권한, 보안 정책 |
| `supabase/seed.sql` | 첫 버전 지도에서 옮겨 온 데이터 (뉴스, 해외 기업 60곳, 국내 드론기업 278곳, 권역 통계) |
| `scripts/push_supabase.py` | 수집한 뉴스·국내 기업 데이터를 Supabase에 쓰는 스크립트 |
| `scripts/update_kr.py` | 드론정보포털에서 국내 드론기업 목록과 권역별 통계를 받아 오는 스크립트 |

## 처음 설정하기

### 1. Supabase
1. https://supabase.com 에서 새 프로젝트를 만듭니다 (무료 플랜으로 충분합니다).
2. **SQL Editor**에서 `supabase/schema.sql` 전체를 붙여 넣고 실행한 다음, `supabase/seed.sql`도 같은 방법으로 실행합니다.
3. **Project Settings > API**에서 *Project URL*과 *anon public* 키를 `assets/config.js`에 넣습니다. anon 키는 공개용이라 저장소에 올려도 됩니다.
   *service_role* 키는 절대 이 파일이나 채팅에 넣지 마세요.
4. **Authentication > URL Configuration**
   - *Site URL*: 사이트 주소 (예: `https://<도메인>.tech`)
   - *Redirect URLs*: 같은 주소와 `https://0927lee.github.io/drone-news-map-Public/`
5. (선택) Google 로그인: **Authentication > Providers > Google**을 켜고 `assets/config.js`의 `googleLogin`을 `true`로 바꿉니다.

### 2. 운영자 권한
사이트에서 직접 가입하고 회원 정보를 입력한 뒤, SQL Editor에서 한 번 실행합니다.

```sql
update public.profiles set is_admin = true
where id = (select id from auth.users where email = '운영자 이메일');
```

이후 오른쪽 위 **Members** 버튼으로 가입자 목록을 볼 수 있습니다.

### 3. GitHub Pages
저장소 **Settings > Pages**에서 *Deploy from a branch*, 브랜치 `main`, 폴더 `/ (root)`를 고릅니다.

### 4. .tech 도메인 연결
1. 도메인 업체의 DNS 설정에 다음을 추가합니다.
   - `A` 레코드 4개 (호스트 `@`): `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
   - `AAAA` 레코드 4개 (호스트 `@`): `2606:50c0:8000::153`, `2606:50c0:8001::153`, `2606:50c0:8002::153`, `2606:50c0:8003::153`
   - `CNAME` 레코드 (호스트 `www`): `0927lee.github.io`
2. 저장소 **Settings > Pages > Custom domain**에 도메인을 입력하고, 확인되면 *Enforce HTTPS*를 켭니다.
3. Supabase의 Site URL과 Redirect URLs에 새 도메인을 추가합니다.

## 데이터 갱신
뉴스는 매시간, 국내 드론기업은 매월 자동으로 수집됩니다. 수집 작업은 환경 변수
`SUPABASE_URL`, `SUPABASE_SERVICE_KEY`로 데이터베이스에 씁니다.

```bash
python3 -I scripts/update_kr.py out/              # 드론정보포털에서 받아 out/에 저장
python3 -I scripts/push_supabase.py kr out/       # Supabase에 반영
python3 -I scripts/push_supabase.py news news.json
```

국내 기업 정보는 드론정보포털에 공개된 기업 정보만 쓰며, 대표자·연락처·이메일·상세 주소는 저장하지 않습니다.
위치는 시군구 중심 좌표입니다.
