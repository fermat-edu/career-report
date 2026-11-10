/* 페르마 제출함 (Google Apps Script)
   ※ 맨 위 두 줄(FOLDER_NAME, TEACHER_KEY)은 지금 쓰고 계신 값 그대로 두세요. 그 아래만 바꾸면 돼요.
   - 학생 제출 보관 (진로탐구·고등학교 조사 보고서)
   - 선생님이 등록한 고등학교 자료(정리 결과 + 원본 PDF) 보관·전달 */
const FOLDER_NAME = '○○ 제출함';
const TEACHER_KEY = '여기에비밀번호';

const SCHOOL_FOLDER = FOLDER_NAME + ' - 고등학교 자료';
function folderByName_(n){const it=DriveApp.getFoldersByName(n);return it.hasNext()?it.next():DriveApp.createFolder(n);}
function folder_(){return folderByName_(FOLDER_NAME);}
function sfolder_(){return folderByName_(SCHOOL_FOLDER);}
function out_(o){return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);}
function inFolder_(f,fd){const id=fd.getId(),ps=f.getParents();while(ps.hasNext())if(ps.next().getId()===id)return true;return false;}
function clean_(s,n){return String(s||'').replace(/[\\/:*?"<>|]/g,'').slice(0,n||60);}
function replaceFile_(fd,name,blob){const it=fd.getFilesByName(name);while(it.hasNext())it.next().setTrashed(true);return fd.createFile(blob.setName(name));}

function doPost(e){try{const d=JSON.parse(e.postData.contents);
  if(d.action==='saveSchool'){ // 선생님: 학교 자료 저장 (part: json | eval | feat)
    if(d.key!==TEACHER_KEY) return out_({ok:false,error:'password'});
    const base=clean_(d.year,4)+'_'+clean_(d.school,40);
    if(d.part==='json') replaceFile_(sfolder_(),base+'.json',Utilities.newBlob(d.data,'application/json'));
    else if(d.part==='eval'||d.part==='feat') replaceFile_(sfolder_(),base+'_'+d.part+'.pdf',Utilities.newBlob(Utilities.base64Decode(d.pdf),'application/pdf'));
    else return out_({ok:false,error:'part'});
    return out_({ok:true});
  }
  if(!d.pdf) return out_({ok:false,error:'no file'});
  const stamp=Utilities.formatDate(new Date(),'Asia/Seoul','MMdd_HHmm');
  const name=String(d.label||'이름없음').replace(/[\\/:*?"<>|]/g,'').slice(0,60)+'_'+stamp+'.pdf';
  folder_().createFile(Utilities.newBlob(Utilities.base64Decode(d.pdf),'application/pdf',name));return out_({ok:true,file:name});}
 catch(err){return out_({ok:false,error:String(err)});}}

function doGet(e){const p=e.parameter||{};
  // 누구나: 등록된 학교 목록과 원본 PDF (학생 페이지에서 사용)
  if(p.action==='schools'){ const list=[],fs=sfolder_().getFiles(),pdfs={};
    while(fs.hasNext()){const f=fs.next(),n=f.getName();
      if(/\.json$/.test(n)) list.push({name:n.replace(/\.json$/,''),time:f.getLastUpdated().getTime(),data:f.getBlob().getDataAsString()});
      else if(/_(eval|feat)\.pdf$/.test(n)) pdfs[n.replace(/\.pdf$/,'')]=f.getId(); }
    list.forEach(x=>{x.evalId=pdfs[x.name+'_eval']||'';x.featId=pdfs[x.name+'_feat']||'';});
    return out_({ok:true,schools:list}); }
  if(p.action==='schooldoc'){ const f=DriveApp.getFileById(p.id); if(!inFolder_(f,sfolder_())) return out_({ok:false,error:'not found'});
    return out_({ok:true,pdf:Utilities.base64Encode(f.getBlob().getBytes())}); }
  if(p.key!==TEACHER_KEY) return out_({ok:false,error:'password'});
  if(p.action==='delSchool'){ const base=clean_(p.name,50), fs=sfolder_().getFiles();
    while(fs.hasNext()){const f=fs.next(); if(f.getName().indexOf(base)===0) f.setTrashed(true);} return out_({ok:true}); }
  if(p.action==='list'){const list=[],files=folder_().getFiles();while(files.hasNext()){const f=files.next();list.push({id:f.getId(),name:f.getName(),time:f.getDateCreated().getTime(),size:f.getSize()});}list.sort((a,b)=>b.time-a.time);return out_({ok:true,files:list});}
  if(p.action==='file'||p.action==='delete'){const f=DriveApp.getFileById(p.id);if(!inFolder_(f,folder_()))return out_({ok:false,error:'not found'});
   if(p.action==='delete'){f.setTrashed(true);return out_({ok:true});}
   return out_({ok:true,name:f.getName(),pdf:Utilities.base64Encode(f.getBlob().getBytes())});}
  return out_({ok:true});}
