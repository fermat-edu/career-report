/* 고등학교 자료 올리기·정리·고치기 화면 (선생님 페이지와 학생 페이지가 같이 씀) */
(function(){
const K={};
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const LIBS=[
 ["JSZip","https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"],
 ["pako","https://cdnjs.cloudflare.com/ajax/libs/pako/2.1.0/pako.min.js"],
 ["pdfjsLib","https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"],
 ["PDFLib","https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js"],
 ["html2canvas","https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"],
 ["jspdf","https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"],
 ["SchoolParse","school-parse.js?v=3"]];
function load(src){return new Promise((res,rej)=>{const s=document.createElement("script"); s.src=src; s.onload=res; s.onerror=()=>rej(new Error("불러오기 실패: "+src)); document.head.appendChild(s);});}
K.loadLibs=async function(){
  for(const [g,src] of LIBS) if(!window[g]) await load(src);
  if(window.pdfjsLib&&pdfjsLib.GlobalWorkerOptions&&!pdfjsLib.GlobalWorkerOptions.workerSrc) pdfjsLib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
};
const CSS=`.sk{display:flex;flex-direction:column;gap:12px}
.sk .skrow{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:8px}
.sk label{display:flex;flex-direction:column;gap:4px;font-size:13px;font-weight:700}
.sk input[type=text],.sk input[type=number],.sk textarea,.sk select{font:inherit;font-weight:400;color:inherit;background:var(--field,#f6f9f9);border:1px solid var(--line,#ccd);border-radius:8px;padding:8px 10px;box-sizing:border-box;width:100%}
.sk .fbox{border:1.5px dashed var(--line,#bbb);border-radius:10px;padding:10px 12px;display:flex;flex-direction:column;gap:6px}
.sk .fbox b{font-size:14px} .sk .fbox small{color:var(--muted,#666);font-weight:400;font-size:12.5px}
.sk .warn{background:#fff4e5;color:#7a4a00;border:1px solid #f0c27a;border-radius:8px;padding:8px 10px;font-size:13px}
.sk .evr{border:1px solid var(--line,#ccd);border-radius:10px;padding:8px 10px;display:grid;grid-template-columns:2fr 70px 70px auto;gap:6px;align-items:start}
.sk .evr textarea{grid-column:1/-1;min-height:56px;font-size:13px}
.sk .evr.chk{border-color:#e08a00;box-shadow:0 0 0 1px #e08a00 inset}
.sk .tag{font-size:11px;font-weight:700;color:#fff;background:#e08a00;border-radius:4px;padding:1px 6px;white-space:nowrap}
.sk .x{font:inherit;font-size:12px;border:1px solid var(--line,#ccd);background:transparent;color:inherit;border-radius:6px;padding:4px 8px;cursor:pointer}
.sk .clr{display:grid;grid-template-columns:auto 1fr;gap:6px;align-items:start;border-bottom:1px solid var(--line,#dde);padding:6px 0}
.sk .clr textarea{min-height:40px;font-size:12.5px}
.sk .cl{max-height:420px;overflow:auto;border:1px solid var(--line,#ccd);border-radius:10px;padding:4px 10px}
.sk h4{margin:6px 0 0;font-size:14.5px}
.sk .hint{font-size:12.5px;color:var(--muted,#666)}
.sk .skwarn{background:#fee500;border-radius:10px;padding:10px 12px;font-size:13.5px;line-height:1.6;margin:6px 0}
.sk .sktime{background:#fff7e0;border:1px solid #f2c94c;border-radius:10px;padding:9px 12px;font-size:13px;line-height:1.6;margin:6px 0}
.sk .fl{font-size:12.5px;margin-top:6px;line-height:1.6}.sk .fl small{color:var(--muted,#666)}.sk .fl .bad{color:#b26a00}
.sk .evhelp{background:#eef6f7;border:1px solid #bcd9dc;border-radius:10px;padding:10px 12px;font-size:13.5px;line-height:1.65;color:#1d2b2d}
.sk .evhelp summary{cursor:pointer;font-weight:700}
.sk .evhelp ol{margin:6px 0 4px;padding-left:20px}.sk .evhelp code{background:#fff;border:1px solid #cfdcdd;border-radius:4px;padding:0 4px;font-size:12.5px}
.sk .evhelp .ex{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:6px}.sk .evhelp .ex div{background:#fff;border-radius:8px;padding:6px 8px;border:1px solid #d6e2e3;white-space:pre-line;font-size:12.5px}
.sk .evhead{display:grid;grid-template-columns:2fr 70px 70px auto;gap:6px;font-size:12px;font-weight:700;color:var(--muted,#666);padding:0 11px}
.sk .evsum{grid-column:1/-1;font-size:12.5px;color:#1f7a4d}.sk .evr.chk .evsum{color:#b26a00;font-weight:700}`;
function injectCss(){ if(document.getElementById("skcss")) return; const s=document.createElement("style"); s.id="skcss"; s.textContent=CSS; document.head.appendChild(s); }

// 1) 파일 올리는 칸
K.uploadHtml=function(id,o={}){
  injectCss(); const y=new Date().getFullYear();
  return '<div class="sk" id="'+id+'">'+
   '<div class="skrow"><label>학교 이름<input type="text" data-k="school" placeholder="예: ○○고등학교" value="'+esc(o.school||"")+'"></label>'+
   '<label>공시 연도<input type="number" data-k="year" value="'+(o.year||y)+'" min="2020" max="2100"></label></div>'+
   (K.inApp()?'<p class="skwarn">⚠️ 지금 <b>카카오톡(앱 안) 브라우저</b>로 열려 있어요. 여기서는 파일 고르기·오래 걸리는 정리·저장이 중간에 멈출 수 있어요. <b>크롬·사파리·삼성 인터넷</b>으로 다시 열어서 올려 주세요.</p>':'')+
   '<p class="hint">학교알리미 → 학교 검색 → 공시정보에서 받은 파일을 넣어 주세요. <b>hwp·hwpx·pdf·xlsx</b> 모두 돼요. 여러 개를 한 번에 골라도 돼요.</p>'+
   '<p class="sktime">⏳ <b>시간 안내:</b> 파일을 정리하고 원본을 만드는 데 보통 <b>1~3분</b>, 파일이 크면(한글 파일 수십 쪽·스캔 PDF) <b>3~5분</b>까지 걸려요. 그동안 <b>화면을 끄거나 다른 앱으로 넘어가지 말고</b> 기다려 주세요. 컴퓨터에서 하면 더 빨라요.</p>'+
   [["ev","① 교과별(학년별) 교수·학습 및 평가계획","학업성취사항 메뉴 · 과목별 파일 여러 개 가능"],["club","② 동아리 활동 현황 / 동아리 운영계획서","교육활동 메뉴"],["feat","③ 교육운영 특색사업 계획","교육활동 메뉴 · 과학중점·AI중점 계획서도 여기에"]]
    .map(([k,t,s])=>'<div class="fbox"><b>'+t+'</b><small>'+s+'</small><input type="file" multiple data-f="'+k+'"><div class="fl" data-fl="'+k+'"></div></div>').join("")+
   (o.logo!==false?'<div class="fbox"><b>④ 학교 로고 (선택)</b><small>보고서 첫 쪽에 들어가요. 학교 홈페이지의 교표 이미지를 저장해서 올리세요. 로고만 올리면 기본 11개 학교에도 로고만 붙어요.</small><input type="file" accept="image/*" data-f="logo"></div>':'')+
   '</div>';
};
let WL=null; K.awake=async function(on){ try{ if(on&&!WL&&navigator.wakeLock){ WL=await navigator.wakeLock.request("screen"); WL.addEventListener("release",()=>{WL=null;}); } else if(!on&&WL){ WL.release(); WL=null; } }catch(e){} };
K.OKEXT=/\.(hwp|hwpx|pdf|xlsx)$/i;
K.inApp=function(){ const ua=navigator.userAgent||""; return /KAKAOTALK|Instagram|FBAN|FBAV|Line\/|NAVER\(inapp|everytimeApp|DaumApps/i.test(ua); };
document.addEventListener("change",e=>{ const t=e.target; if(!t.matches||!t.matches('.sk input[type=file][data-f]')||t.dataset.f==="logo") return;
  const box=t.parentNode.querySelector("[data-fl]"); if(!box) return; const mb=b=>b>1048576?(b/1048576).toFixed(1)+"MB":Math.max(1,Math.round(b/1024))+"KB";
  box.innerHTML=[...t.files].map(f=>K.OKEXT.test(f.name)?'<div>📄 '+esc(f.name)+' <small>'+mb(f.size)+'</small></div>':'<div class="bad">⚠️ '+esc(f.name)+' <small>— 이 형식은 못 읽어요 (hwp·hwpx·pdf·xlsx만 돼요)</small></div>').join(""); });
K.readUpload=function(root){
  const g=k=>root.querySelector('[data-k="'+k+'"]').value.trim(), f=k=>[...root.querySelector('[data-f="'+k+'"]').files].filter(x=>K.OKEXT.test(x.name));
  const lg=root.querySelector('[data-f="logo"]');
  return {school:g("school"),year:+g("year")||new Date().getFullYear(),files:{ev:f("ev"),club:f("club"),feat:f("feat")},logo:lg&&lg.files[0]||null};
};
K.logoDataUrl=function(file){ return new Promise((res,rej)=>{ if(!file) return res(""); const r=new FileReader(); r.onerror=rej; r.onload=()=>{ const im=new Image(); im.onerror=rej; im.onload=()=>{
  const k=Math.min(1,360/Math.max(im.width,im.height)); const c=document.createElement("canvas"); c.width=Math.round(im.width*k); c.height=Math.round(im.height*k);
  c.getContext("2d").drawImage(im,0,0,c.width,c.height); res(c.toDataURL("image/png")); }; im.src=r.result; }; r.readAsDataURL(file); }); };

// 2) 정리 결과 고치는 칸
K.editorHtml=function(d,res){
  injectCss();
  const ev=d.ev||[], clubs=d.clubs||[];
  return '<div class="sk" data-editor>'+
   ((res&&res.warn&&res.warn.length)?'<div class="warn">⚠️ '+res.warn.map(esc).join("<br>⚠️ ")+'</div>':'')+
   '<div class="skrow"><label>학교 구분<select data-k="type">'+["","남녀공학","남자고등학교","여자고등학교"].map(t=>'<option'+(t===(d.type||"")?' selected':'')+'>'+t+'</option>').join("")+'</select></label>'+
   '<label>1학년 학급 수<input type="number" data-k="cls" value="'+(d.cls||"")+'" min="0"></label></div>'+
   '<label>학교 특색 (한 줄에 하나, 비워도 돼요 · 원본은 뒤에 붙어요)<textarea data-k="feat" rows="3">'+esc((d.feat||[]).join("\n"))+'</textarea></label>'+
   '<h4>1학년 1학기 과목별 평가 ('+ev.length+'과목)</h4>'+
   '<details class="evhelp" open><summary>이 칸 보는 법 · 고치는 법</summary>'+
   '<ol><li><b>과목 이름</b> · <b>중간 %</b> · <b>기말 %</b>: 정기고사(지필) 반영 비율이에요.</li>'+
   '<li><b>아래 큰 칸</b>: 수행평가만 한 줄에 하나씩 <code>영역 이름 비율</code>로 적어요. 예: <code>독서 프로젝트 20</code></li>'+
   '<li><b>주황색 테두리</b>: 중간+기말+수행 합계가 100이 아니에요. 원본을 보고 숫자를 고쳐 주세요. 맞으면 초록 글씨로 ‘합계 100%’가 떠요.</li>'+
   '<li>큰 칸에 <code>1 차시험 ( 중간시험 ) 100 30</code>처럼 시험 줄이 들어가 있으면, 그 줄은 지우고 <b>마지막 숫자(반영 비율 30)</b>를 중간/기말 칸에 넣어요. (100은 만점이라 쓰지 않아요)</li>'+
   '<li>과목 이름이 <b>공통국어2</b>처럼 ‘2’로 끝나면 <b>2학기 파일</b>이에요. 학교알리미에서 자료제출일 <b>(1차) 4월</b> 파일을 받아 다시 올려 주세요.</li></ol>'+
   '<div class="ex"><div>❌ 잘못 정리된 예\n중간 0 · 기말 0\n1 차시험 ( 중간시험 ) 100 30\n2 차시험 ( 기말시험 ) 100 30\n포트폴리오 20</div><div>✅ 고친 예\n중간 30 · 기말 30\n포트폴리오 20\n(나머지 수행평가 영역…)\n→ 합계 100%</div></div></details>'+
   '<div class="evhead"><span>과목</span><span>중간 %</span><span>기말 %</span><span></span></div>'+
   '<div data-ev>'+ev.map(evRow).join("")+'</div><button type="button" class="x" data-addev>+ 과목 추가</button>'+
   '<h4>동아리 ('+clubs.length+'개) <span class="hint">1학년이 들어갈 수 있는 동아리만 남기고 체크를 빼세요.</span></h4>'+
   '<div class="cl" data-cl>'+clubs.map(clubRow).join("")+'</div><button type="button" class="x" data-addcl>+ 동아리 추가</button>'+
   '</div>';
};
function sumTxt(t){ return Math.abs(t-100)>0.5?"⚠️ 합계 "+(Math.round(t*10)/10)+"% · 100%가 되도록 확인해 주세요":"✓ 합계 100%"; }
function evRow(e){ const t=(+e.mid||0)+(+e.fin||0)+(e.p||[]).reduce((a,x)=>a+(+x[1]||0),0);
  return '<div class="evr'+(Math.abs(t-100)>0.5?' chk':'')+'"><input type="text" data-e="s" value="'+esc(e.s||"")+'" placeholder="과목"><input type="number" data-e="mid" value="'+(e.mid||0)+'" title="중간 %"><input type="number" data-e="fin" value="'+(e.fin||0)+'" title="기말 %">'+
   '<button type="button" class="x" data-delev>빼기</button><textarea data-e="p" placeholder="수행평가만 · 한 줄에 하나 · 예: 독서 프로젝트 20">'+esc((e.p||[]).map(x=>x[0]+" "+x[1]).join("\n"))+'</textarea><div class="evsum">'+sumTxt(t)+'</div></div>'; }
function clubRow(c){ return '<div class="clr"><input type="checkbox" data-c="on" checked aria-label="포함"><div><input type="text" data-c="n" value="'+esc(c.n)+'"><textarea data-c="d" placeholder="설명 (원본에 있는 내용)">'+esc(c.d||"")+'</textarea><input type="hidden" data-c="a" value="'+esc(JSON.stringify(c.a||[]))+'"></div></div>'; }
K.bindEditor=function(root){
  root.addEventListener("click",e=>{
    if(e.target.closest("[data-addev]")){ root.querySelector("[data-ev]").insertAdjacentHTML("beforeend",evRow({s:"",mid:30,fin:30,p:[]})); }
    else if(e.target.closest("[data-delev]")){ e.target.closest(".evr").remove(); }
    else if(e.target.closest("[data-addcl]")){ root.querySelector("[data-cl]").insertAdjacentHTML("beforeend",clubRow({n:"",d:"",a:[]})); }
  });
  root.addEventListener("input",e=>{ const r=e.target.closest(".evr"); if(!r) return; const d=readEv(r); const t=d.mid+d.fin+d.p.reduce((a,x)=>a+x[1],0); r.classList.toggle("chk",Math.abs(t-100)>0.5); const sm=r.querySelector(".evsum"); if(sm) sm.textContent=sumTxt(t); });
};
function readEv(r){ const v=k=>r.querySelector('[data-e="'+k+'"]').value;
  const p=v("p").split("\n").map(l=>l.trim()).filter(Boolean).map(l=>{const m=l.match(/^(.*?)\s+(\d+(?:\.\d+)?)\s*%?$/); return m?[m[1].trim(),+m[2]]:[l,0];});
  return {s:v("s").trim(),mid:+v("mid")||0,fin:+v("fin")||0,p}; }
K.readEditor=function(root){
  const g=k=>root.querySelector('[data-k="'+k+'"]').value;
  const ev=[...root.querySelectorAll(".evr")].map(readEv).filter(e=>e.s);
  const clubs=[...root.querySelectorAll(".clr")].filter(r=>r.querySelector('[data-c="on"]').checked).map(r=>({n:r.querySelector('[data-c="n"]').value.trim(),d:r.querySelector('[data-c="d"]').value.trim(),a:JSON.parse(r.querySelector('[data-c="a"]').value||"[]")})).filter(c=>c.n);
  return {type:g("type"),cls:+g("cls")||null,feat:g("feat").split("\n").map(x=>x.trim()).filter(Boolean),ev,clubs};
};

// 3) 원본 PDF 만들기
K.buildPdfs=async function(res,school,year,onStep){
  const t1=school+" "+year+"학년도 1학년 1학기 교수학습 및 평가 운영 계획 (원본)", t2=school+" "+year+"학년도 교육운영 특색사업 (원본)";
  let ev=res.evDocs.length?await SchoolParse.buildOriginal(res.evDocs,t1,s=>onStep&&onStep("평가계획 "+s),"ev"):null;
  let ft=res.featDocs.length?await SchoolParse.buildOriginal(res.featDocs,t2,s=>onStep&&onStep("특색사업 "+s),"feat"):null;
  if(ev) ev=await K.shrink(ev,"평가계획",onStep);
  if(ft) ft=await K.shrink(ft,"특색사업",onStep);
  return {ev,ft};
};
/* 원본이 너무 크면(스캔본·사진 많은 파일) 쪽마다 그림으로 다시 찍어 크기를 줄임 — 구글 제출함은 한 번에 약 50MB까지만 받아요 */
K.LIMIT=15*1048576;
K.shrink=async function(doc,label,onStep){
  if(!doc||!doc.bytes||doc.bytes.length<=K.LIMIT||!window.pdfjsLib||!window.jspdf) return doc;
  const mb=b=>(b/1048576).toFixed(1)+"MB", orig=doc.bytes.length;
  const src=await pdfjsLib.getDocument({data:doc.bytes.slice()}).promise, N=src.numPages;
  for(const [W,Q] of [[1240,0.7],[1000,0.6],[820,0.5]]){
    const {jsPDF}=window.jspdf; let pdf=null;
    for(let i=1;i<=N;i++){
      onStep&&onStep(label+" 파일이 커서("+mb(orig)+") 크기를 줄이는 중… ("+i+"/"+N+")");
      const pg=await src.getPage(i), v1=pg.getViewport({scale:1}), vp=pg.getViewport({scale:W/v1.width});
      const c=document.createElement("canvas"); c.width=Math.round(vp.width); c.height=Math.round(vp.height);
      const ctx=c.getContext("2d"); ctx.fillStyle="#fff"; ctx.fillRect(0,0,c.width,c.height);
      await pg.render({canvasContext:ctx,viewport:vp}).promise;
      const w=210, h=c.height*w/c.width;
      if(!pdf) pdf=new jsPDF({orientation:"p",unit:"mm",format:[w,Math.max(h,10)]}); else pdf.addPage([w,Math.max(h,10)],"p");
      pdf.addImage(c.toDataURL("image/jpeg",Q),"JPEG",0,0,w,h); c.width=c.height=0;
    }
    const out=new Uint8Array(pdf.output("arraybuffer"));
    if(out.length<=K.LIMIT*2||W===820){ onStep&&onStep(label+" 크기 줄임: "+mb(orig)+" → "+mb(out.length)); return Object.assign({},doc,{bytes:out}); }
  }
  return doc;
};
K.toB64=function(bytes){ let s=""; const C=0x8000; for(let i=0;i<bytes.length;i+=C) s+=String.fromCharCode.apply(null,bytes.subarray(i,i+C)); return btoa(s); };
K.fromB64=function(b){ const s=atob(b), u=new Uint8Array(s.length); for(let i=0;i<s.length;i++) u[i]=s.charCodeAt(i); return u; };
window.SchoolKit=K;
})();
