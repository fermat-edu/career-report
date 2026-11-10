/* 페르마 고등학교 조사 — 학교알리미 공시 파일 자동 정리 (브라우저에서 동작)
   지원: .hwp .hwpx .pdf .xlsx
   필요한 라이브러리(페이지에서 먼저 불러오기): jszip, pako, pdf.js, pdf-lib, html2canvas, jspdf
   블록 형식: ["p",텍스트] | ["t",{cells:[[행,열,행합침,열합침,너비,[블록...]]...]}] */
(function(){
const SP={};
const norm=s=>String(s||"").replace(/\s+/g," ").trim();
const nows=s=>String(s||"").replace(/\s+/g,"");

/* ===================== HWP (바이너리) ===================== */
function u16(d,o){return d[o]|(d[o+1]<<8);}
function u32(d,o){return (d[o]|(d[o+1]<<8)|(d[o+2]<<16))+d[o+3]*16777216;}
function CFB(d){
  const H=d.subarray(0,512);
  if(u32(H,0)!==0xE011CFD0) throw new Error("not hwp");
  const ss=1<<u16(H,30), mss=1<<u16(H,32), nfat=u32(H,44), dirStart=u32(H,48), cutoff=u32(H,56), miniStart=u32(H,60), difStart=u32(H,68);
  const sec=i=>d.subarray((i+1)*ss,(i+2)*ss);
  let difat=[]; for(let i=0;i<109;i++) difat.push(u32(H,76+i*4));
  let s=difStart, guard=0;
  while(s<0xFFFFFFFA&&guard++<10000){const b=sec(s), n=ss/4; for(let i=0;i<n-1;i++) difat.push(u32(b,i*4)); s=u32(b,(n-1)*4);}
  const fat=[];
  for(const f of difat.slice(0,nfat)){ if(f>=0xFFFFFFFA) continue; const b=sec(f); for(let i=0;i<ss/4;i++) fat.push(u32(b,i*4)); }
  const chain=st=>{const parts=[];let i=st,g=0;while(i<0xFFFFFFFA&&g++<1e6){parts.push(sec(i));i=fat[i];}return cat(parts);};
  const dir=chain(dirStart), ents=[];
  for(let o=0;o+128<=dir.length;o+=128){
    const nl=u16(dir,o+64); let name=""; for(let k=0;k<Math.max(nl-2,0);k+=2) name+=String.fromCharCode(u16(dir,o+k));
    ents.push({name,typ:dir[o+66],l:u32(dir,o+68),r:u32(dir,o+72),c:u32(dir,o+76),start:u32(dir,o+116),size:u32(dir,o+120)});
  }
  const root=ents[0]; const ministream=root.start<0xFFFFFFFA?chain(root.start).subarray(0,root.size):new Uint8Array(0);
  const minifat=[]; if(miniStart<0xFFFFFFFA){const mf=chain(miniStart); for(let i=0;i+4<=mf.length;i+=4) minifat.push(u32(mf,i));}
  const minichain=st=>{const parts=[];let i=st,g=0;while(i<0xFFFFFFFA&&g++<1e6){parts.push(ministream.subarray(i*mss,(i+1)*mss));i=minifat[i];}return cat(parts);};
  const paths={};
  const walk=(i,pre)=>{ if(i>=0xFFFFFFFA||i>=ents.length) return; const e=ents[i]; walk(e.l,pre); walk(e.r,pre);
    const p=pre+e.name; if(e.typ===2) paths[p]=e; else if(e.typ===1) walk(e.c,p+"/"); };
  walk(root.c,"");
  return {paths,read:p=>{const e=paths[p]; return (e.size<cutoff?minichain(e.start):chain(e.start)).subarray(0,e.size);}};
}
function cat(parts){let n=0;for(const p of parts)n+=p.length;const o=new Uint8Array(n);let k=0;for(const p of parts){o.set(p,k);k+=p.length;}return o;}
const EXT=new Set([1,2,3,11,12,14,15,16,17,18,21,22,23]), INL=new Set([4,5,6,7,8,9,19,20]);
function hptext(b){
  let out="",i=0; const n=b.length>>1;
  while(i<n){const c=u16(b,i*2);
    if(c<32){ if(EXT.has(c)||INL.has(c)) i+=8; else { if(c===9) out+=" "; i+=1; } continue; }
    out+=String.fromCharCode(c); i++; }
  return out;
}
function* records(d){
  let i=0;
  while(i+4<=d.length){const h=u32(d,i); i+=4; const tag=h&0x3FF, lvl=(h>>>10)&0x3FF; let sz=h>>>20;
    if(sz===0xFFF){sz=u32(d,i); i+=4;} yield [tag,lvl,d.subarray(i,i+sz)]; i+=sz;}
}
function hwpBlocks(buf){
  const c=CFB(new Uint8Array(buf));
  const fh=c.read("FileHeader"); const flags=u32(fh,36);
  if(flags&2) return [["p","[암호가 걸린 파일이라 읽을 수 없어요]"]];
  const secs=Object.keys(c.paths).filter(p=>p.startsWith("BodyText/Section")).sort((a,b)=>+a.split("Section")[1]-+b.split("Section")[1]);
  const out=[];
  for(const p of secs){
    let d=c.read(p); if(flags&1) d=window.pako.inflateRaw(d);
    const stack=[]; const target=()=>stack.length&&stack[stack.length-1].cur?stack[stack.length-1].cur[5]:out;
    for(const [tag,lvl,b] of records(d)){
      while(stack.length&&lvl<=stack[stack.length-1].lvl){const t=stack.pop(); target().push(["t",{cells:t.cells}]);}
      if(tag===77) stack.push({lvl:lvl-1,cells:[],cur:null});
      else if(tag===72&&stack.length&&b.length>=20&&lvl===stack[stack.length-1].lvl+1){
        const cell=[u16(b,10),u16(b,8),Math.max(1,u16(b,14)),Math.max(1,u16(b,12)),u32(b,16),[]];
        stack[stack.length-1].cells.push(cell); stack[stack.length-1].cur=cell;
      } else if(tag===67){ const t=hptext(b).replace(/\r/g,"").trim(); if(t) target().push(["p",t]); }
    }
    while(stack.length){const t=stack.pop(); target().push(["t",{cells:t.cells}]);}
  }
  return out;
}

/* ===================== HWPX ===================== */
const LN=e=>e.localName;
function xPar(p,dst){
  let buf="";
  const flush=()=>{const s=buf.trim(); buf=""; if(s) dst.push(["p",s]);};
  const rec=e=>{ for(const ch of e.children){ const t=LN(ch);
      if(t==="tbl"){flush(); dst.push(["t",xTbl(ch)]); continue;}
      if(t==="t"){ for(const n of ch.childNodes){ if(n.nodeType===3) buf+=n.nodeValue; else if(LN(n)==="tab") buf+=" "; } continue; }
      if(t==="lineBreak"){buf+="\n";continue;}
      rec(ch);} };
  rec(p); flush();
}
function xTbl(t){
  const cells=[];
  for(const tr of t.children){ if(LN(tr)!=="tr") continue;
    for(const tc of tr.children){ if(LN(tc)!=="tc") continue;
      let row=0,col=0,rs=1,cs=1,w=0; const bl=[];
      for(const ch of tc.children){ const n=LN(ch);
        if(n==="cellAddr"){col=+ch.getAttribute("colAddr")||0; row=+ch.getAttribute("rowAddr")||0;}
        else if(n==="cellSpan"){cs=+ch.getAttribute("colSpan")||1; rs=+ch.getAttribute("rowSpan")||1;}
        else if(n==="cellSz"){w=+ch.getAttribute("width")||0;}
        else if(n==="subList"){ for(const p of ch.children) if(LN(p)==="p") xPar(p,bl); } }
      cells.push([row,col,Math.max(rs,1),Math.max(cs,1),w,bl]); } }
  return {cells};
}
async function hwpxBlocks(buf){
  const z=await JSZip.loadAsync(buf);
  const names=Object.keys(z.files).filter(n=>/^Contents\/section\d+\.xml$/.test(n)).sort((a,b)=>+a.match(/\d+/)[0]-+b.match(/\d+/)[0]);
  const out=[];
  for(const n of names){ const doc=new DOMParser().parseFromString(await z.file(n).async("string"),"application/xml");
    for(const p of doc.documentElement.children) if(LN(p)==="p") xPar(p,out); }
  return out;
}

/* ===================== XLSX (동아리 명단) ===================== */
async function xlsxRows(buf){
  const z=await JSZip.loadAsync(buf);
  const ss=[]; const sf=z.file("xl/sharedStrings.xml");
  if(sf){ const d=new DOMParser().parseFromString(await sf.async("string"),"application/xml");
    for(const si of d.getElementsByTagNameNS("*","si")) ss.push([...si.getElementsByTagNameNS("*","t")].map(t=>t.textContent).join("")); }
  const sheets=Object.keys(z.files).filter(n=>/^xl\/worksheets\/sheet\d+\.xml$/.test(n)).sort();
  const rows=[];
  for(const sn of sheets){ const d=new DOMParser().parseFromString(await z.file(sn).async("string"),"application/xml");
    for(const r of d.getElementsByTagNameNS("*","row")){ const cells=[];
      for(const c of r.getElementsByTagNameNS("*","c")){ const ref=c.getAttribute("r")||""; const col=colIdx(ref.replace(/\d+/g,""));
        const v=c.getElementsByTagNameNS("*","v")[0]; let val=v?v.textContent:"";
        if(c.getAttribute("t")==="s") val=ss[+val]||""; else if(c.getAttribute("t")==="inlineStr") val=c.textContent;
        cells[col]=val; }
      rows.push(cells.map(x=>x==null?"":String(x))); } }
  return rows;
}
function colIdx(s){let n=0;for(const ch of s) n=n*26+(ch.charCodeAt(0)-64);return n-1;}

/* ===================== PDF ===================== */
async function pdfPagesText(buf){
  const pdf=await pdfjsLib.getDocument({data:new Uint8Array(buf.slice(0))}).promise; const pages=[];
  for(let i=1;i<=pdf.numPages;i++){ const tc=await (await pdf.getPage(i)).getTextContent();
    // y좌표로 줄 만들기
    const lines={}; for(const it of tc.items){ if(!it.str) continue; const y=Math.round(it.transform[5]/3); (lines[y]=lines[y]||[]).push(it); }
    const txt=Object.keys(lines).map(Number).sort((a,b)=>b-a).map(y=>lines[y].sort((a,b)=>a.transform[4]-b.transform[4]).map(x=>x.str).join("  ")).join("\n");
    pages.push(txt); }
  return pages;
}

/* ===================== 공통: 파일 읽기 ===================== */
SP.readFile=async function(file){
  const name=file.name, buf=await file.arrayBuffer(), ext=(name.match(/\.(\w+)$/)||[,""])[1].toLowerCase();
  if(ext==="hwp") return {name,kind:"hwp",blocks:hwpBlocks(buf)};
  if(ext==="hwpx") return {name,kind:"hwp",blocks:await hwpxBlocks(buf)};
  if(ext==="pdf") return {name,kind:"pdf",bytes:new Uint8Array(buf),pages:await pdfPagesText(buf)};
  if(ext==="xlsx") return {name,kind:"xlsx",rows:await xlsxRows(buf)};
  throw new Error(name+": hwp, hwpx, pdf, xlsx 파일만 읽을 수 있어요");
};

/* ===================== 표 도우미 ===================== */
const textOf=bl=>bl.map(([k,v])=>k==="p"?v:v.cells.map(c=>textOf(c[5])).join(" ")).join(" ");
function grid(t){ // 행 번호 → 칸들(열 순서)
  const rows={}; for(const c of t.cells){ (rows[c[0]]=rows[c[0]]||[]).push(c); }
  const keys=Object.keys(rows).map(Number).sort((a,b)=>a-b);
  return keys.map(r=>rows[r].sort((a,b)=>a[1]-b[1]));
}
const ctext=c=>norm(textOf(c[5]));
function cellAt(t,r,col){ return t.cells.find(c=>c[0]<=r&&r<c[0]+c[2]&&c[1]<=col&&col<c[1]+c[3]); }

/* ===================== 학년 판단 ===================== */
// 블록이 "몇 학년 자료"의 시작인지
function gradeMark(k,v){
  if(k==="p"){ const s=norm(v); if(s.length>60) return null;
    let m=s.match(/^<\s*([123])\s*학년/)||s.match(/^\d\.\s*([123])\s*학년$/)||s.match(/([123])\s*학년\s*1?\s*학기\s*\[/)||s.match(/^([123])\s*학년\s*$/);
    return m?m[1]:null; }
  // 표: "학년" 머리칸 아래 값, 또는 제목줄 "N학년 1학기 [과목]"
  const G=grid(v); if(!G.length) return null;
  const t0=norm(textOf([[k,v]])).slice(0,120); let m=t0.match(/([123])\s*학년\s*1\s*학기\s*\[/)||t0.match(/1\s*학기\s*([123])\s*학년\s+\S+\s+교수/);
  if(m) return m[1];
  for(let ri=0;ri<Math.min(G.length-1,3);ri++){ const h=G[ri].find(c=>/^학\s*년$/.test(ctext(c)));
    if(h){ const below=cellAt(v,G[ri+1][0][0],h[1]); const mm=below&&ctext(below).match(/^([123])\s*학년/); if(mm) return mm[1]; } }
  return null;
}
SP.grade1Blocks=function(bl){
  let g=null, seenAny=false; const out=[];
  for(const [k,v] of bl){ const m=gradeMark(k,v); if(m){g=m; seenAny=true;} if(g===null||g==="1") out.push([k,v]); }
  return out;
};
function pdfGrade1Pages(pages){
  for(let i=0;i<pages.length;i++){ const head=pages[i].slice(0,900); const m=head.match(/(?:^|\s)([123])\s*학년\s/); if(m&&m[1]!=="1"&&i>0) return [...Array(i).keys()]; }
  return [...Array(pages.length).keys()];
}

/* ===================== 평가 비율 뽑기 ===================== */
const SUBJ=/(공통\s*국어\s*[12]?|공통\s*수학\s*[12]?|공통\s*영어\s*[12]?|한국사\s*[12]?|통합\s*사회\s*[12]?|통합\s*과학\s*[12]?|과학\s*탐구\s*실험\s*[12]?|체육\s*[12]?|음악|미술|정보|기술\s*[·ㆍ]?\s*가정|중국어|일본어|진로와\s*직업|생태와\s*환경|한문)/;
function subjFromText(s){ s=norm(s);
  let m=s.match(/\[\s*([^\]\d][^\]]{1,19}?)\s*\]\s*(?:과|교과)?\s*교수/); if(m) return m[1].trim();
  m=s.match(/<\s*1\s*학년\s*([^>]{2,20})>/); if(m) return m[1].trim();
  m=s.match(/1\s*학년\s*1\s*학기\s*([^\s]{2,15})\s*교수/); if(m) return m[1].trim();
  return null; }
function stripGuide(s){ s=String(s||""); if(/★|주세요|합니다\./.test(s)){ const parts=s.split(/합니다\.|주세요\.?\s*|\)\s*(?=[가-힣A-Za-z])/); s=parts[parts.length-1]; } return norm(s.replace(/★[^★]*★/g,"")); }
function cleanName(c){ const ps=c[5].filter(b=>b[0]==="p").map(b=>b[1]).filter(x=>!/★|적어\s*주세요|작성해\s*주세요|검토해\s*주세요/.test(x)||/합니다\.\s*\S/.test(x));
  return stripGuide((ps.length?ps:c[5].filter(b=>b[0]==="p").map(b=>b[1])).join(" ")).replace(/\s*\/\s*/g," "); }
function num(s){ const m=String(s).replace(/,/g,"").match(/(\d+(?:\.\d+)?)/); return m?+m[1]:null; }
function pureNum(s){ return /^\s*\d+(\.\d+)?\s*(%|점)?\s*$/.test(String(s)); }
function evalTable(t){
  const G=grid(t); let hr=-1,cName=-1,cMax=-1,cRat=-1;
  for(let i=0;i<Math.min(G.length,4)&&hr<0;i++){
    for(const c of G[i]){ const x=nows(ctext(c));
      if(/평가영역|영역명|고사.?영역|평가내용/.test(x)&&cName<0) cName=c[1];
      if(/만점/.test(x)&&cMax<0) cMax=c[1];
      if(/반영비율|반영비률/.test(x)&&!/유형별/.test(x)&&(/학기말/.test(x)||cRat<0)) { if(/학기말/.test(x)||cRat<0) cRat=c[1]; } }
    if(cName>=0&&cRat>=0) hr=i;
  }
  if(hr<0) return null;
  const startRow=G[hr][0][0]+Math.max(...G[hr].map(c=>c[2]));
  const exam=[],perf=[]; let kind=""; const used=new Set();
  for(const row of G){ const r=row[0][0]; if(r<startRow) continue;
    const all=row.map(ctext).join(" "); if(/합\s*계|총\s*계/.test(all)) break;
    const nameC=cellAt(t,r,cName), ratC=cellAt(t,r,cRat), maxC=cMax>=0?cellAt(t,r,cMax):null;
    if(!nameC||!ratC||nameC===ratC||used.has(nameC)) continue; used.add(nameC);
    const nm=cleanName(nameC); const rv=ctext(ratC);
    // 평가 방법 칸(맨 앞)으로 지필/수행 구분
    const left=t.cells.filter(c=>c[0]<=r&&r<c[0]+c[2]&&c[1]+c[3]<=cName).map(ctext).join(" ");
    if(/수행/.test(left)) kind="p"; else if(/정기|지필/.test(left)) kind="e";
    if(!nm||/^(점|%)$/.test(nm)) continue;
    let ratio=num(rv); if(ratio===null||!pureNum(rv.replace(/[()]/g,""))&&!/\d/.test(rv)) continue;
    if(maxC&&maxC!==nameC&&num(ctext(maxC))===0) ratio=0;
    const isExam=kind==="e"||(!kind&&/중간|기말|[12]\s*차\s*(시험|고사)|[12]\s*회\s*고사|지필/.test(nm));
    if(ratio>0) (isExam?exam:perf).push([nm,ratio]);
  }
  if(!exam.length&&!perf.length) return null;
  const mid=exam.find(e=>/중간|1\s*차|1\s*회/.test(e[0])), fin=exam.find(e=>/기말|2\s*차|2\s*회/.test(e[0]));
  return {mid:mid?mid[1]:(exam.length===2?exam[0][1]:0),fin:fin?fin[1]:(exam.length===2?exam[1][1]:(exam.length===1&&!mid?exam[0][1]:0)),p:perf};
}
// 문서 순서대로 훑으며 과목 이름·학년·평가표 찾기
function scanEval(bl,fileName,out){
  let subj=null, grade=null;
  const fs=subjFromText(fileName)||(fileName.match(SUBJ)||[])[1];
  const visit=(blocks,depth)=>{
    for(const [k,v] of blocks){
      if(k==="p"){ const s=subjFromText(v); if(s) subj=s; const g=gradeMark(k,v); if(g) grade=g; continue; }
      const g=gradeMark(k,v); if(g) grade=g;
      const G=grid(v);
      // "과목" 머리칸 아래 값
      for(let ri=0;ri<Math.min(G.length-1,3);ri++){ const h=G[ri].find(c=>/^과\s*목\s*(명)?$/.test(ctext(c)));
        if(h){ const below=cellAt(v,G[ri+1][0][0],h[1]); const s=below&&ctext(below); if(s&&!/과목/.test(s)){ const cl=stripGuide(s); if(cl.length<=20) subj=cl.replace(/\s*\(.*\)$/,""); } } }
      const t0=subjFromText(textOf([[k,v]]).slice(0,200)); if(t0&&G.length<=3) subj=t0;
      const ev=evalTable(v);
      if(ev){ if(grade===null||grade==="1") out.push({s:stripGuide(subj||fs||fileName.replace(/\.\w+$/,"")).replace(/^과목명을\s*/,""),...ev}); continue; }
      if(depth<3) for(const c of v.cells) visit(c[5],depth+1);
    }
  };
  visit(bl,0);
}
// PDF 글자에서 평가 비율 (정확도 낮음 → 미리보기에서 고칠 수 있음)
function scanEvalPdf(pages,fileName,out,keep){
  let subj=null; const ks=new Set(keep||pages.map((_,i)=>i));
  pages.forEach((pg,pi)=>{
    if(!ks.has(pi)) return;
    const head=pg.slice(0,700); const sm=head.match(/\[\s*([^\]\d][^\]]{1,19}?)\s*\]/)||head.match(SUBJ); if(sm&&/교수|평가|학년|과\s*목/.test(head)) subj=norm(sm[1]);
    const i=pg.search(/평가\s*방법과\s*반영\s*비\s*율|평가방법\s*및\s*반영비율/); if(i<0) return;
    const seg=pg.slice(i,i+1800).split("\n"); const exam=[],perf=[]; let pend="";
    for(const raw of seg.slice(1)){ const L=norm(raw); if(/합\s*계/.test(L)) break;
      let m=L.match(/(1\s*차|2\s*차|중간|기말)\s*(시험|고사)?\s+(\d{2,3})\s+(\d{1,2}(?:\.\d)?)/);
      if(m){ exam.push([m[1],+m[4]]); pend=""; continue; }
      m=L.match(/^(.*?[가-힣].*?)\s+(\d{1,2})\s+(\d{1,2})(\s|$)/);
      if(m&&+m[2]===+m[3]&&!/평가|영역|만점|반영|선택형/.test(m[1])){ perf.push([norm((pend+" "+m[1]).replace(/^(수행|평가)\s+/,"")),+m[3]]); pend=""; continue; }
      if(/[가-힣]{2,}/.test(L)&&!/평가|영역|만점|반영|선택형|단답형|서술형|논술형|정기|시험\s*$/.test(L)&&L.length<30) pend=L; else pend="";
    }
    if(exam.length||perf.length){ const mid=exam.find(e=>/1|중간/.test(e[0])), fin=exam.find(e=>/2|기말/.test(e[0]));
      out.push({s:subj||fileName.replace(/\.\w+$/,""),mid:mid?mid[1]:0,fin:fin?fin[1]:0,p:perf,fromPdf:true}); }
  });
}

/* ===================== 동아리 뽑기 ===================== */
function tidy(d){ return norm(d||"").replace(/[\uf000-\uf8ff]/g,"").replace(/^(?:[ⅠⅡⅢⅣⅤ]\s*)?운영의?\s*목적\s*/,"").replace(/\s+([,.):;])/g,"$1").replace(/([(])\s+/g,"$1").replace(/^[-·•]\s*/,"").trim(); }
function scanClubs(f,out){
  const key=x=>nows(x).replace(/[()（）]/g,"");
  const add=(n,d)=>{ n=norm(n); if(/^[\[「(（].*[\]」)）]$/.test(n)) n=n.slice(1,-1).trim(); if(n.length<2||out.some(c=>key(c.n)===key(n))) return out.find(c=>key(c.n)===key(n))||null; if(!n||n.length>40||/^(동아리|명|부서명)$/.test(n)) return null;
    const c={n,d:tidy(d),a:[]}; out.push(c); return c; };
  if(f.kind==="xlsx"){
    const R=f.rows; let hc=-1,gc=-1,dc=-1,hr=-1;
    for(let i=0;i<Math.min(R.length,15)&&hr<0;i++) R[i].forEach((x,j)=>{const s=nows(x); if(/동아리명|부서명|^동아리$/.test(s)&&hc<0){hc=j;hr=i;} });
    if(hr<0) return;
    R[hr].forEach((x,j)=>{const s=nows(x); if(/대상학년|학년|학번/.test(s)&&gc<0) gc=j; if(/목적|목표|활동내용|설명/.test(s)&&dc<0) dc=j;});
    const seen=new Set();
    for(const r of R.slice(hr+1)){ const n=norm(r[hc]); if(!n||seen.has(n)||/^\*/.test(n)) continue;
      if(gc>=0){ const g=String(r[gc]||""); if(/^\d{5}$/.test(g)?g[0]!=="1":(g&&!/1|전/.test(g))) continue; }
      seen.add(n); add(n,dc>=0?r[dc]:""); }
    return;
  }
  if(f.kind==="pdf"){
    const txt=f.pages.join("\n");
    const re=/동아리\s*명(?!\s*단)\s*[:：]?[ \t]*([^\n]*)/g; let m; const idx=[];
    while((m=re.exec(txt))){ let n=m[1].split(/\s{2,}/)[0].replace(/(지도\s*교사|대표|담당).*$/,"").trim();
      if(!n){ const prev=txt.slice(0,m.index).split("\n").map(x=>x.trim()).filter(Boolean).pop()||""; if(prev.length<=30&&!/[:：]|계획서|학년|교시|활동/.test(prev)) n=prev; }
      if(n) idx.push([m.index,n]); }
    { const alt=[]; const re2=/^\s*(.{2,40}?)\s*동아리\s*(?:연간\s*)?운영\s*계획서\s*$/gm; while((m=re2.exec(txt))){ if(!/학교|학년도|차\s*례/.test(m[1])) alt.push([m.index,m[1].trim()]); } if(alt.length>=Math.max(3,idx.length)) idx.splice(0,idx.length,...alt); }
    idx.forEach(([pos,n],i)=>{ const seg=txt.slice(pos,i+1<idx.length?idx[i+1][0]:pos+4000);
      let g=null; const SL=seg.split("\n");
      for(let li=0;li<SL.length&&!g;li++){ const mm=SL[li].match(/^(.*?)(활동\s*목적|활동\s*목표|운영의?\s*목적|동아리\s*소개)\s*[:：]?\s*(.*)$/); if(!mm) continue;
        const after=norm(mm[3]), prev=norm(SL[li-1]||""), next=norm(SL[li+1]||""), bad=/동아리\s*명|지도\s*교사|분류|대상\s*학년|연번|회원/;
        if(after.length>5) g=[0,after+(next&&!bad.test(next)&&next.length>15&&!/^[-Ⅰ-Ⅹ\d]/.test(next)?" "+next:"")];
        else if(/운영의\s*목적/.test(mm[2])) g=[0,SL.slice(li+1,li+4).map(norm).filter(x=>x&&!bad.test(x)).join(" ")];
        else if(prev.length>8&&!bad.test(prev)) g=[0,prev];
        else if(next.length>5&&!bad.test(next)) g=[0,next]; }
      const yr=seg.match(/대상\s*학년\s+([0-9,\s학년전]+)/)||(txt.slice(Math.max(0,pos-800),pos).match(/\(\s*([123,\s]+)\s*학년\s*\)/g)||[]).slice(-1).map(x=>[x,x])[0]; if(yr&&!/1|전/.test(yr[1])) return;
      add(n,g?g[1]:""); });
    return;
  }
  // hwp/hwpx: 표의 "동아리명" 칸, "[ 이름 ]" 줄, "○ 동아리 명 : 이름" 줄
  let cur=null;
  const visit=bl=>{ for(const [k,v] of bl){
    if(k==="p"){ const s=norm(v); let m=s.match(/^\[\s*(.{2,30}?)\s*\]$/)||s.match(/동아리\s*명\s*[:：]\s*(.+)$/);
      if(!m){ const t=s.match(/^(.{2,40}?)\s*(?:연간\s*)?(?:운영|활동)\s*계획(?:서)?$/); if(t&&!/학교|학년도|동아리\s*$|^\d/.test(t[1])) m=t; }
      if(m){ cur=add(m[1].replace(/\s*동아리$/,"")||m[1],""); continue; }
      if(cur&&!cur.d){ m=s.match(/^(?:○\s*)?동아리\s*소개\s*[:：]?\s*(.{10,})$/); if(m) cur.d=tidy(m[1]); }
      continue; }
    const G=grid(v);
    for(const row of G) for(let i=0;i<row.length;i++){ const lab=nows(ctext(row[i])); const nx=row[i+1];
      if(/^(동아리명|동아리이름|부서명)$/.test(lab)&&nx){ cur=add(ctext(nx),""); }
      else if(cur&&/^(동아리)?(활동|운영)?(목적|목표)$/.test(lab)&&nx&&!cur.d){ cur.d=ctext(nx); } }
    // "운영 목표" 바로 다음 표(1칸)
    if(cur&&!cur.d&&G.length===1&&G[0].length===1&&ctext(G[0][0]).length>15){ cur.d=ctext(G[0][0]); }
    // 활동 계획 표: 날짜·회차 칸 다음의 내용
    if(cur){ const hdr=G.find(r=>r.some(c=>/활동\s*(내용|주제)|^내\s*용$|활동명/.test(ctext(c))));
      if(hdr){ const hc=hdr.find(c=>/활동\s*(주제|내용)|^내\s*용$|활동명/.test(ctext(c)));
        for(const row of G){ if(row[0][0]<=hdr[0][0]) continue; const c=cellAt(v,row[0][0],hc[1]); const s=c&&ctext(c);
          if(s&&s.length<60&&!/합\s*계|총\s*\d+\s*시간/.test(s)&&cur.a[cur.a.length-1]!==s) cur.a.push(s.replace(/\s*\/\s*/g," ")); } } }
    for(const c of v.cells) visit(c[5]);
  } };
  visit(f.blocks);
}

/* ===================== 자동 정리 ===================== */
// files: {ev:[파일], club:[파일], feat:[파일]} (File 객체)
SP.analyze=async function(files,onStep){
  const step=s=>onStep&&onStep(s);
  const res={ev:[],clubs:[],evDocs:[],featDocs:[],warn:[]};
  for(const f of files.ev||[]){ step("평가계획 읽는 중: "+f.name); const r=await SP.readFile(f);
    if(r.kind==="hwp"){ scanEval(r.blocks,r.name,res.ev); res.evDocs.push({name:r.name,kind:"hwp",blocks:SP.grade1Blocks(r.blocks)}); }
    else if(r.kind==="pdf"){ const keep=pdfGrade1Pages(r.pages); scanEvalPdf(r.pages,r.name,res.ev,keep);
      if(!r.pages.join("").trim()) res.warn.push(r.name+": 스캔한 PDF라 글자를 읽을 수 없어요. 원본은 그대로 붙지만 요약표는 직접 적어야 해요.");
      res.evDocs.push({name:r.name,kind:"pdf",bytes:r.bytes,keep,text:r.pages}); }
    else res.warn.push(r.name+": 평가계획은 hwp·hwpx·pdf만 읽어요"); }
  for(const f of files.club||[]){ step("동아리 자료 읽는 중: "+f.name); const r=await SP.readFile(f); scanClubs(r,res.clubs); }
  for(const f of files.feat||[]){ step("특색사업 읽는 중: "+f.name); const r=await SP.readFile(f);
    if(r.kind==="hwp") res.featDocs.push({name:r.name,kind:"hwp",blocks:r.blocks}); else if(r.kind==="pdf") res.featDocs.push({name:r.name,kind:"pdf",bytes:r.bytes,keep:null}); }
  // 같은 과목 겹치면 앞의 것, 합계 100 아닌 것 표시
  const seen=new Set(); res.ev=res.ev.filter(e=>{const k=nows(e.s); if(seen.has(k)) return false; seen.add(k); return true;});
  res.ev.forEach(e=>{const t=e.mid+e.fin+e.p.reduce((a,x)=>a+x[1],0); if(Math.abs(t-100)>0.5) e.check=true;});
  const cs=new Set(); res.clubs=res.clubs.filter(c=>{if(cs.has(c.n)) return false; cs.add(c.n); return true;});
  if(!res.ev.length) res.warn.push("평가 비율표를 찾지 못했어요. 요약표는 직접 적고, 원본은 그대로 붙어요.");
  if((files.club||[]).length&&!res.clubs.length) res.warn.push("동아리 이름을 찾지 못했어요. 동아리는 직접 적어 주세요.");
  return res;
};

/* ===================== 원본을 PDF로 ===================== */
const CSS=`.sp-page{width:794px;min-height:1123px;box-sizing:border-box;padding:40px 38px 46px;background:#fff;color:#111;font-family:'Noto Sans KR','Apple SD Gothic Neo','Malgun Gothic',sans-serif;font-size:11.5px;line-height:1.4;position:relative}
.sp-page p{margin:2px 0;white-space:pre-wrap;word-break:keep-all;overflow-wrap:anywhere}
.sp-page table{border-collapse:collapse;width:100%;margin:4px 0 8px;table-layout:fixed}
.sp-page td{border:0.8px solid #555;padding:2px 3px;vertical-align:middle;word-break:keep-all;overflow-wrap:anywhere;font-size:10.5px}
.sp-page td div{white-space:pre-wrap}
.sp-page .dh{font-size:10px;color:#666;border-bottom:1px solid #999;margin-bottom:6px;padding-bottom:2px}
.sp-page .ft{position:absolute;bottom:16px;left:0;right:0;text-align:center;font-size:9px;color:#888}`;
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c])).replace(/\n/g,"<br>");
function cellsHtml(bl){ return bl.map(([k,v])=>k==="p"?"<div>"+esc(v)+"</div>":tableEl(v).outerHTML).join(""); }
function colWidths(cells){
  const ncol=Math.max(...cells.map(c=>c[1]+c[3])); const cw=new Array(ncol).fill(0);
  for(const c of cells) if(c[3]===1&&c[4]>0) cw[c[1]]=Math.max(cw[c[1]],c[4]);
  for(const c of cells) if(c[4]>0){ let known=0; const unk=[]; for(let i=c[1];i<c[1]+c[3];i++){known+=cw[i]; if(!cw[i]) unk.push(i);} if(unk.length&&c[4]>known) unk.forEach(i=>cw[i]=(c[4]-known)/unk.length); }
  const tot=cw.reduce((a,b)=>a+b,0)||1; return cw.map(x=>x?100*x/tot:100/ncol);
}
function tableEl(t,rowFrom,rowTo){
  const cells=t.cells; const tb=document.createElement("table");
  if(!cells.length) return tb;
  tb.innerHTML="<colgroup>"+colWidths(cells).map(w=>'<col style="width:'+w.toFixed(2)+'%">').join("")+"</colgroup>";
  const body=document.createElement("tbody"); tb.appendChild(body);
  const rows=[...new Set(cells.map(c=>c[0]))].sort((a,b)=>a-b);
  const lo=rowFrom??-1, hi=rowTo??1e9;
  for(const r of rows){ if(r<lo||r>=hi) continue; const tr=document.createElement("tr");
    // 위 쪽에서 이어지는 합친 칸은 빈칸으로 다시 만듦
    const carry=r===lo&&lo>0?cells.filter(c=>c[0]<lo&&c[0]+c[2]>lo):[];
    const here=cells.filter(c=>c[0]===r).concat(carry.map(c=>[lo,c[1],c[0]+c[2]-lo,c[3],c[4],[]])).sort((a,b)=>a[1]-b[1]);
    for(const c of here){ const td=document.createElement("td"); const rs=Math.min(c[2],hi-r); if(rs>1) td.rowSpan=rs; if(c[3]>1) td.colSpan=c[3]; td.innerHTML=cellsHtml(c[5]); tr.appendChild(td); }
    body.appendChild(tr); }
  return tb;
}
// 블록들을 A4 쪽 단위로 나눠 html2canvas → jsPDF
SP.renderDocsToPdf=async function(docs,title,onStep){
  const {jsPDF}=window.jspdf; const pdf=new jsPDF({orientation:"p",unit:"mm",format:"a4"}); let pageCount=0; const texts=[];
  const stage=document.createElement("div"); stage.style.cssText="position:fixed;left:-12000px;top:0;width:794px";
  const st=document.createElement("style"); st.textContent=CSS; stage.appendChild(st); document.body.appendChild(stage);
  const pages=[]; let pg=null, body=null;
  const LIMIT=1123-46;
  const newPage=dh=>{ pg=document.createElement("div"); pg.className="sp-page"; pg.innerHTML='<div class="dh">'+esc(dh)+'</div>'; stage.appendChild(pg); pages.push(pg); body=pg; };
  const over=()=>{ const l=pg.lastElementChild; return !!l&&(l.offsetTop+l.offsetHeight)>LIMIT; };
  try{
    for(const d of docs){
      newPage(title+" · "+d.name.replace(/\.\w+$/,""));
      for(const [k,v] of d.blocks){
        if(k==="p"){ const p=document.createElement("p"); p.innerHTML=esc(v); body.appendChild(p); if(over()&&body.children.length>2){ p.remove(); newPage(title); body.appendChild(p);} continue; }
        const rows=[...new Set(v.cells.map(c=>c[0]))].sort((a,b)=>a-b); let from=rows[0]??0;
        let tb=tableEl(v,from); body.appendChild(tb);
        while(over()){
          // 넘치면 들어가는 데까지 행 수를 줄임
          let lo=rows.indexOf(from)+1, hi=rows.length, fit=-1;
          while(lo<=hi){ const mid=(lo+hi)>>1; tb.remove(); tb=tableEl(v,from,rows[mid]??1e9); body.appendChild(tb); if(!over()){fit=mid;lo=mid+1;} else hi=mid-1; }
          tb.remove();
          if(fit<0){ if(body.children.length>1){ newPage(title); tb=tableEl(v,from); body.appendChild(tb); if(!over()) break; continue; }
            fit=rows.indexOf(from)+1; } // 한 행이 한 쪽보다 크면 그냥 넘침 허용
          if(fit>=rows.length){ tb=tableEl(v,from); body.appendChild(tb); break; }
          tb=tableEl(v,from,rows[fit]); body.appendChild(tb);
          from=rows[fit]; newPage(title); tb=tableEl(v,from); body.appendChild(tb);
        }
      }
    }
    if(document.fonts&&document.fonts.ready) await document.fonts.ready;
    for(let i=0;i<pages.length;i++){
      onStep&&onStep("원본 쪽 만드는 중 ("+(i+1)+"/"+pages.length+")");
      texts.push(pages[i].innerText||"");
      const f=document.createElement("div"); f.className="ft"; f.textContent=title+" · "+(i+1)+"/"+pages.length; pages[i].appendChild(f);
      const cv=await html2canvas(pages[i],{scale:1.4,backgroundColor:"#fff",logging:false});
      const h=Math.max(297,cv.height*210/cv.width);
      if(pageCount) pdf.addPage([210,h],"p"); else if(h>297){ pdf.deletePage(1); pdf.addPage([210,h],"p"); }
      pdf.addImage(cv.toDataURL("image/jpeg",0.72),"JPEG",0,0,210,cv.height*210/cv.width); pageCount++;
    }
  } finally { stage.remove(); }
  return pageCount?{bytes:new Uint8Array(pdf.output("arraybuffer")),texts}:null;
};
// 성취기준 코드([10공수1-01-01] 등)가 처음 나오는 쪽 = 그 과목 시작 쪽
const CODE=[["공국","공통국어"],["공수","공통수학"],["공영","공통영어"],["한사","한국사"],["통사","통합사회"],["통과","통합과학"],["과탐","과학탐구실험"],["체육","체육"],["음","음악"],["미","미술"],["정","정보"],["기가","기술·가정"],["중어","중국어"],["일어","일본어"],["생환","생태와 환경"],["진로","진로와 직업"],["보건","보건"],["한문","한문"]];
const NUMBERED=new Set(["공통국어","공통수학","공통영어","한국사","통합사회","통합과학","과학탐구실험","체육"]);
SP.codeToc=function(texts){
  const out=[], seen=new Set();
  texts.forEach((t,i)=>{ const re=/\[\s*(\d{2})([가-힣]{1,4})(\d{0,2})\s*-\s*\d{2}/g; let m;
    while((m=re.exec(t||""))){ const hit=CODE.find(([k])=>m[2]===k||m[2].startsWith(k)); if(!hit) continue;
      const nm=hit[1]+(m[3].length===1&&NUMBERED.has(hit[1])?m[3]:""); if(seen.has(hit[1])) continue; seen.add(hit[1]); out.push([nm,i+1]); } });
  return out;
};
// 평가계획/특색사업 문서 묶음 → 하나의 PDF (pdf는 고른 쪽만, 한글은 쪽으로 그림)
SP.buildOriginal=async function(docs,title,onStep,mode){
  const out=await PDFLib.PDFDocument.create(); const texts=[], starts=[];
  for(const d of docs){
    starts.push([d.name.replace(/\.\w+$/,"").replace(/^\d+(-\d+)?\s*\.\s*/,""),out.getPageCount()+1]);
    if(d.kind==="pdf"){ const src=await PDFLib.PDFDocument.load(d.bytes,{ignoreEncryption:true}); const idx=d.keep||src.getPageIndices();
      (await out.copyPages(src,idx)).forEach(p=>out.addPage(p)); idx.forEach(i=>texts.push((d.text||[])[i]||"")); }
    else { const b=await SP.renderDocsToPdf([d],title,onStep); if(b){ const src=await PDFLib.PDFDocument.load(b.bytes); (await out.copyPages(src,src.getPageIndices())).forEach(p=>out.addPage(p)); texts.push(...b.texts); } }
  }
  if(!out.getPageCount()) return null;
  const toc=mode==="ev"?SP.codeToc(texts):starts;
  return {bytes:await out.save(),pages:out.getPageCount(),toc:toc.length?toc:starts};
};
SP._test={hwpBlocks,hwpxBlocks,scanEval,scanClubs,evalTable,grid,textOf,pdfGrade1Pages,scanEvalPdf};
window.SchoolParse=SP;
})();
