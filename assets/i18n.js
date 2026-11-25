/* Text in English and Korean, and lookup tables for place and field names. */
let LANG="en";try{const l=localStorage.getItem("lang");if(l==="ko"||l==="en")LANG=l}catch(e){}
const STR={
 en:{title:"World Drone News Map",sub:"Drone news and companies worldwide, on one map",connecting:"Connecting to data…",range:"Period",r1:"24 hours",r7:"7 days",r30:"30 days",cats:"Topic",kinds:"Organization type",map:"World map of drone news",zin:"Zoom in",zout:"Zoom out",zreset:"Show whole world",feed:"News list",latest:"Latest drone news",placeNews:p=>`News in ${p}`,selPlace:"selected place",all:"Show all",count:n=>`${n} ${n===1?"story":"stories"}`,loading:"Loading news…",noMatch:"No news matches these filters. Try a longer period or turn more topics on.",noNews:"No news yet. Stories appear here automatically as they are collected.",legendNews:"News (number = stories, pulsing = last 24 h)",legendHint:"Click a marker for details · zoom into Korea for regions and individual firms",more:n=>`+${n} more`,hq:"Headquarters",loc:"Location",field:"Field",founded:"Founded",products:"Main products",airframe:"Airframe",type:"Type",source:"Source",website:"Website ↗",readMore:"Read article ↗",close:"Close ✕",closeAria:"Close",live:(t,n)=>`Live · last update ${t} · ${n} stories`,slow:"Data connection is slow",signin:"Sign in to see live news",signinBody:"Open this page while signed in to claude.ai to see the news.",loadFail:"Couldn't load the news. Refresh the page to try again.",regionTip:(n,t,m,u)=>`<b>${n}</b> ${t} drone businesses<br>Manufacturing ${m} · Services ${u}`,korea:"South Korea (all)",krDesc:"Description in Korean, from the portal",collected:d=>`collected ${d}`,portalSrc:"Drone Information Portal company search (droneportal.or.kr)",statsSrc:"Drone Information Portal statistics",lang:"한국어",origTitle:"Original headline",
  gTitle:"Join to view the map",gIntro:"Register once with your details to see live drone news and the company map. Your details are visible only to the site owner.",lName:"Name",lOrg:"Organization",lRole:"Role",lCountry:"Country (optional)",lPurpose:"Why are you using this map? (optional)",lConsent:"I agree that the site owner may store these details to manage access.",gSubmit:"Join and view the map",gNeed:"Please fill in your name, organization and role, and tick the consent box.",gFail:"Couldn't save your registration. You may only have view access; ask the owner to give you access to use the page.",gSignTitle:"Sign in required",gSignBody:"Open this page while signed in to claude.ai to register and view the map.",roles:{industry:"Industry / company",government:"Government / public sector",research:"University / research",media:"Media",investor:"Investor",student:"Student",other:"Other"},membersBtn:n=>`Members (${n})`,mTitle:n=>`Registered members (${n})`,mCols:["Name","Organization","Role","Country","Purpose","Joined"],mClose:"Close ✕"},
 ko:{title:"월드 드론 뉴스맵",sub:"전 세계 드론 뉴스와 기업을 지도 위에서",connecting:"데이터 연결 중…",range:"기간",r1:"24시간",r7:"7일",r30:"30일",cats:"분야",kinds:"기관 유형",map:"드론 뉴스 세계 지도",zin:"확대",zout:"축소",zreset:"전체 보기",feed:"뉴스 목록",latest:"최신 드론 뉴스",placeNews:p=>`${p} 뉴스`,selPlace:"선택한 위치",all:"전체 보기",count:n=>`${n}건`,loading:"뉴스를 불러오는 중입니다.",noMatch:"이 조건에 맞는 뉴스가 없습니다. 기간을 넓히거나 분야 필터를 켜 보세요.",noNews:"아직 들어온 뉴스가 없습니다. 수집 작업이 돌면 여기에 자동으로 나타납니다.",legendNews:"뉴스 (숫자=기사 수, 깜빡임=24시간 이내)",legendHint:"기관 표시를 누르면 상세 정보 · 한국을 확대하면 권역별·개별 기업",more:n=>`외 ${n}건`,hq:"본사",loc:"위치",field:"분야",founded:"설립",products:"주요 제품",airframe:"기체 종류",type:"구분",source:"출처",website:"웹사이트 ↗",readMore:"원문 보기 ↗",close:"닫기 ✕",closeAria:"닫기",live:(t,n)=>`실시간 연결 · 마지막 수집 ${t} · 기사 ${n}건`,slow:"데이터 연결이 늦어지고 있습니다",signin:"로그인하면 실시간 뉴스가 보입니다",signinBody:"claude.ai에 로그인한 상태에서 열면 뉴스가 표시됩니다.",loadFail:"뉴스를 불러오지 못했습니다. 새로고침해 주세요",regionTip:(n,t,m,u)=>`<b>${n}</b> 드론 사업체 ${t}개사<br>제작 ${m} · 활용 ${u}`,korea:"대한민국 전체",krDesc:"",collected:d=>`${d} 수집`,portalSrc:"드론정보포털 드론기업검색 (droneportal.or.kr)",statsSrc:"드론정보포털 드론통계",lang:"English",origTitle:"원문 제목",
  gTitle:"회원가입 후 이용할 수 있어요",gIntro:"처음 한 번만 정보를 등록하면 실시간 드론 뉴스와 기업 지도를 볼 수 있어요. 입력한 정보는 사이트 운영자만 볼 수 있어요.",lName:"이름",lOrg:"소속",lRole:"분야",lCountry:"국가 (선택)",lPurpose:"이용 목적 (선택)",lConsent:"접근 관리를 위해 운영자가 위 정보를 저장하는 데 동의합니다.",gSubmit:"가입하고 지도 보기",gNeed:"이름, 소속, 분야를 입력하고 동의에 체크해 주세요.",gFail:"가입 정보를 저장하지 못했어요. 보기 전용 권한일 수 있으니 운영자에게 '사용' 권한을 요청해 주세요.",gSignTitle:"로그인이 필요해요",gSignBody:"claude.ai에 로그인한 상태에서 열면 가입하고 지도를 볼 수 있어요.",roles:{industry:"기업·산업",government:"정부·공공기관",research:"대학·연구기관",media:"언론",investor:"투자자",student:"학생",other:"기타"},membersBtn:n=>`회원 (${n})`,mTitle:n=>`가입 회원 (${n}명)`,mCols:["이름","소속","분야","국가","이용 목적","가입일"],mClose:"닫기 ✕"}};
const T=k=>STR[LANG][k];
const CATS={defense:{en:"Defense",ko:"방산·군사",v:"--c-def"},commercial:{en:"Commercial & delivery",ko:"상업·배송",v:"--c-com"},uam:{en:"eVTOL & UAM",ko:"eVTOL·UAM",v:"--c-uam"},policy:{en:"Policy & regulation",ko:"규제·정책",v:"--c-pol"},business:{en:"Business & funding",ko:"투자·기업",v:"--c-biz"},conflict:{en:"Conflict & security",ko:"분쟁·안보",v:"--c-war"}};
const COUNTRY={"캐나다":"Canada","독일":"Germany","호주":"Australia","인도":"India","일본":"Japan","미국":"United States","수단":"Sudan","대한민국":"South Korea","중국":"China","프랑스":"France","포르투갈":"Portugal","튀르키예":"Türkiye","이스라엘":"Israel","아일랜드":"Ireland","영국":"United Kingdom","스위스":"Switzerland","네덜란드":"Netherlands","푸에르토리코(미국)":"Puerto Rico (US)","우크라이나":"Ukraine","러시아":"Russia","대만":"Taiwan","이탈리아":"Italy","스페인":"Spain","폴란드":"Poland","튀르키예 ":"Türkiye","사우디아라비아":"Saudi Arabia","아랍에미리트":"United Arab Emirates","싱가포르":"Singapore","브라질":"Brazil","멕시코":"Mexico","남아프리카공화국":"South Africa","케냐":"Kenya","르완다":"Rwanda","가나":"Ghana","이란":"Iran","북한":"North Korea","핀란드":"Finland","스웨덴":"Sweden","노르웨이":"Norway","덴마크":"Denmark","에스토니아":"Estonia","라트비아":"Latvia","리투아니아":"Lithuania","벨기에":"Belgium","오스트리아":"Austria","뉴질랜드":"New Zealand","인도네시아":"Indonesia","베트남":"Vietnam","태국":"Thailand","필리핀":"Philippines","말레이시아":"Malaysia","파키스탄":"Pakistan","이집트":"Egypt","나이지리아":"Nigeria","칠레":"Chile","아르헨티나":"Argentina","콜롬비아":"Colombia","카자흐스탄":"Kazakhstan","체코":"Czechia","루마니아":"Romania","그리스":"Greece","헝가리":"Hungary"};
const SIDO={"서울":"Seoul","부산":"Busan","대구":"Daegu","인천":"Incheon","광주":"Gwangju","대전":"Daejeon","울산":"Ulsan","세종":"Sejong","경기":"Gyeonggi","강원":"Gangwon","충북":"North Chungcheong","충남":"South Chungcheong","전북":"North Jeolla","전남":"South Jeolla","경북":"North Gyeongsang","경남":"South Gyeongsang","제주":"Jeju"};
const REGION={"수도권":"Capital Area","강원권":"Gangwon","충청권":"Chungcheong","전라권":"Jeolla","경상권":"Gyeongsang","제주권":"Jeju"};
const TERMS={"감시.정찰.수색/인프라관리":"Surveillance & infrastructure inspection","물류·운송·구조":"Logistics, transport & rescue","공간정보/특수촬영":"Mapping & aerial filming","방역/방제/살포":"Spraying & pest control","환경측량":"Environmental surveying","다목적 H/W":"Multipurpose hardware","방송·공연":"Broadcast & drone shows","취미·교육":"Hobby & education","드론스테이션":"Drone stations","안티드론":"Counter-drone","임무장비":"Mission payloads","모듈":"Modules","지상통제장비":"Ground control equipment","통합솔루션":"Integrated solutions","앱":"Apps","기타":"Other","회전익(멀티콥터)":"Multicopter","회전익(헬리콥터)":"Helicopter","고정익":"Fixed-wing","휴대용":"Handheld","차량용":"Vehicle-mounted","VTOL":"VTOL","H/W":"Hardware","S/W":"Software"};
const trList=v=>v?String(v).split(",").map(x=>x.trim()).filter(Boolean).map(x=>LANG==="en"?(TERMS[x]||x):x).join(", "):v;
const country=c=>LANG==="en"?(COUNTRY[c]||c):c;
const regionName=n=>LANG==="en"?(REGION[n]||n):n;
const krPlace=p=>{if(LANG!=="en"||!p)return p;const[a,...r]=p.split(" ");return SIDO[a]?(r.length?`${r.join(" ")}, ${SIDO[a]}`:SIDO[a]):p};
const L=(o,f)=>LANG==="en"?(o[f+"_en"]??o[f]):o[f];
const catLabel=c=>(CATS[c]||CATS.business)[LANG];
const KINDS={major:{en:"Large & listed",ko:"대기업·상장사",v:"--k-major",sym:"symbolSquare"},startup:{en:"Startups",ko:"스타트업",v:"--k-startup",sym:"symbolTriangle"},sme:{en:"SMEs & mid-sized",ko:"중소·중견기업",v:"--k-sme",sym:"symbolDiamond"},research:{en:"Universities & research",ko:"대학·연구기관",v:"--k-research",sym:"symbolStar"},portal:{en:"Korean firms (Drone Info Portal)",ko:"국내 드론기업(드론정보포털)",v:"--k-portal",sym:"symbolCircle"}};
Object.assign(STR.en,{
  sub:"Drone news, companies and research institutes worldwide",
  signIn:"Sign in",signUp:"Create account",email:"Email",password:"Password (8+ characters)",forgot:"Forgot password?",or:"or",google:"Continue with Google",signOut:"Sign out",
  authHead:"Live drone news from around the world, on one map",
  authBody:"Free for members. Create an account to see the map, the news feed and the company directory.",
  fact1:"Drone news collected every hour, placed where it happened",
  fact2:"Global drone makers, startups, SMEs and research institutes",
  fact3:"Korean drone firms from the Drone Information Portal, by region",
  needEmail:"Enter your email and a password of at least 8 characters.",
  checkMail:"Check your inbox to confirm your email, then sign in.",
  resetSent:"If that email has an account, a reset link is on its way.",
  needEmailOnly:"Enter your email above first.",
  newPass:"Choose a new password",passSaved:"Password updated.",
  badLogin:"Email or password is incorrect.",
  notConfigured:"This site isn't connected to its database yet. The owner needs to fill in assets/config.js.",
  live:(t,n)=>`Live · last update ${t} · ${n} stories`,
  loadFail:"Couldn't load the data. Refresh the page to try again.",
  gTitle:"One more step",gIntro:"Tell us a little about yourself to finish joining. Only the site owner can see these details.",
  gFail:"Couldn't save your details. Please try again.",
  portalCard:"Drone Information Portal",clusterTip:n=>`${n} firms · click to zoom`
});
Object.assign(STR.ko,{
  sub:"전 세계 드론 뉴스, 기업, 연구기관을 지도 위에서",
  signIn:"로그인",signUp:"회원가입",email:"이메일",password:"비밀번호 (8자 이상)",forgot:"비밀번호를 잊으셨나요?",or:"또는",google:"Google로 계속하기",signOut:"로그아웃",
  authHead:"전 세계 드론 뉴스를 지도 한 장으로",
  authBody:"회원은 무료로 이용할 수 있어요. 가입하면 지도, 뉴스 목록, 기업 정보를 볼 수 있어요.",
  fact1:"매시간 수집한 드론 뉴스를 발생 위치에 표시",
  fact2:"해외 드론 제조사, 스타트업, 중소기업, 연구기관",
  fact3:"드론정보포털 등록 국내 드론기업을 권역별로",
  needEmail:"이메일과 8자 이상 비밀번호를 입력해 주세요.",
  checkMail:"메일함에서 인증 메일을 확인한 뒤 로그인해 주세요.",
  resetSent:"가입된 이메일이면 재설정 링크를 보냈어요.",
  needEmailOnly:"먼저 위에 이메일을 입력해 주세요.",
  newPass:"새 비밀번호를 입력하세요",passSaved:"비밀번호를 바꿨어요.",
  badLogin:"이메일 또는 비밀번호가 맞지 않아요.",
  notConfigured:"아직 데이터베이스가 연결되지 않았어요. 운영자가 assets/config.js를 채워야 해요.",
  live:(t,n)=>`실시간 연결 · 마지막 수집 ${t} · 기사 ${n}건`,
  loadFail:"데이터를 불러오지 못했어요. 새로고침해 주세요.",
  gTitle:"마지막 단계예요",gIntro:"가입을 마치려면 간단한 정보를 입력해 주세요. 입력한 정보는 사이트 운영자만 볼 수 있어요.",
  gFail:"정보를 저장하지 못했어요. 다시 시도해 주세요.",
  portalCard:"드론정보포털",clusterTip:n=>`${n}개사 · 눌러서 확대`
});
