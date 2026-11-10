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
 ["SchoolParse","school-parse.js?v=2"]];
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
.sk .hint{font-size:12.5px;color:var(--muted,#666)}`;
function injectCss(){ if(document.getElementById("skcss")) return; const s=document.createElement("style"); s.id="skcss"; s.textContent=CSS; document.head.appendChild(s); }

// 1) 파일 올리는 칸
K.uploadHtml=function(id,o={}){
  injectCss(); const y=new Date().getFullYear();
  return '<div class="sk" id="'+id+'">'+
   '<div class="skrow"><label>학교 이름<input type="text" data-k="school" placeholder="예: ○○고등학교" value="'+esc(o.school||"")+'"></label>'+
   '<label>공시 연도<input type="number" data-k="year" value="'+(o.year||y)+'" min="2020" max="2100"></label></div>'+
   '<p class="hint">학교알리미 → 학교 검색 → 공시정보에서 받은 파일을 넣어 주세요. hwp·hwpx·pdf·xlsx 모두 돼요. 여러 개를 한 번에 골라도 돼요.</p>'+
   [["ev","① 교과별(학년별) 교수·학습 및 평가계획","학업성취사항 메뉴 · 과목별 파일 여러 개 가능"],["club","② 동아리 활동 현황 / 동아리 운영계획서","교육활동 메뉴"],["feat","③ 교육운영 특색사업 계획","교육활동 메뉴 · 과학중점·AI중점 계획서도 여기에"]]
    .map(([k,t,s])=>'<div class="fbox"><b>'+t+'</b><small>'+s+'</small><input type="file" multiple accept=".hwp,.hwpx,.pdf,.xlsx" data-f="'+k+'"></div>').join("")+
   (o.logo!==false?'<div class="fbox"><b>④ 학교 로고 (선택)</b><small>보고서 첫 쪽에 들어가요. 학교 홈페이지의 교표 이미지를 저장해서 올리세요. 로고만 올리면 기본 11개 학교에도 로고만 붙어요.</small><input type="file" accept="image/*" data-f="logo"></div>':'')+
   '</div>';
};
K.readUpload=function(root){
  const g=k=>root.querySelector('[data-k="'+k+'"]').value.trim(), f=k=>[...root.querySelector('[data-f="'+k+'"]').files];
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
   '<h4>1학년 1학기 과목별 평가 ('+ev.length+'과목) <span class="hint">주황색은 합계가 100이 아니라 확인이 필요한 과목이에요. 수행평가는 "이름 비율" 한 줄씩.</span></h4>'+
   '<div data-ev>'+ev.map(evRow).join("")+'</div><button type="button" class="x" data-addev>+ 과목 추가</button>'+
   '<h4>동아리 ('+clubs.length+'개) <span class="hint">1학년이 들어갈 수 있는 동아리만 남기고 체크를 빼세요.</span></h4>'+
   '<div class="cl" data-cl>'+clubs.map(clubRow).join("")+'</div><button type="button" class="x" data-addcl>+ 동아리 추가</button>'+
   '</div>';
};
function evRow(e){ const t=(+e.mid||0)+(+e.fin||0)+(e.p||[]).reduce((a,x)=>a+(+x[1]||0),0);
  return '<div class="evr'+(Math.abs(t-100)>0.5?' chk':'')+'"><input type="text" data-e="s" value="'+esc(e.s||"")+'" placeholder="과목"><input type="number" data-e="mid" value="'+(e.mid||0)+'" title="중간 %"><input type="number" data-e="fin" value="'+(e.fin||0)+'" title="기말 %">'+
   '<button type="button" class="x" data-delev>빼기</button><textarea data-e="p" placeholder="수행평가 이름 비율 (한 줄에 하나)">'+esc((e.p||[]).map(x=>x[0]+" "+x[1]).join("\n"))+'</textarea></div>'; }
function clubRow(c){ return '<div class="clr"><input type="checkbox" data-c="on" checked aria-label="포함"><div><input type="text" data-c="n" value="'+esc(c.n)+'"><textarea data-c="d" placeholder="설명 (원본에 있는 내용)">'+esc(c.d||"")+'</textarea><input type="hidden" data-c="a" value="'+esc(JSON.stringify(c.a||[]))+'"></div></div>'; }
K.bindEditor=function(root){
  root.addEventListener("click",e=>{
    if(e.target.closest("[data-addev]")){ root.querySelector("[data-ev]").insertAdjacentHTML("beforeend",evRow({s:"",mid:30,fin:30,p:[]})); }
    else if(e.target.closest("[data-delev]")){ e.target.closest(".evr").remove(); }
    else if(e.target.closest("[data-addcl]")){ root.querySelector("[data-cl]").insertAdjacentHTML("beforeend",clubRow({n:"",d:"",a:[]})); }
  });
  root.addEventListener("input",e=>{ const r=e.target.closest(".evr"); if(!r) return; const d=readEv(r); const t=d.mid+d.fin+d.p.reduce((a,x)=>a+x[1],0); r.classList.toggle("chk",Math.abs(t-100)>0.5); });
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
  const ev=res.evDocs.length?await SchoolParse.buildOriginal(res.evDocs,t1,s=>onStep&&onStep("평가계획 "+s),"ev"):null;
  const ft=res.featDocs.length?await SchoolParse.buildOriginal(res.featDocs,t2,s=>onStep&&onStep("특색사업 "+s),"feat"):null;
  return {ev,ft};
};
K.toB64=function(bytes){ let s=""; const C=0x8000; for(let i=0;i<bytes.length;i+=C) s+=String.fromCharCode.apply(null,bytes.subarray(i,i+C)); return btoa(s); };
K.fromB64=function(b){ const s=atob(b), u=new Uint8Array(s.length); for(let i=0;i<s.length;i++) u[i]=s.charCodeAt(i); return u; };
window.SchoolKit=K;
})();
