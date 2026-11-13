const YEAR_NOW = new Date().getFullYear();
const classes = ['Genel İdare Hizmetleri','Teknik Hizmetler','Sağlık Hizmetleri ve Yardımcı Sağlık Hizmetleri','Eğitim ve Öğretim Hizmetleri','Avukatlık Hizmetleri','Din Hizmetleri','Emniyet Hizmetleri','Yardımcı Hizmetler','Diğer'];
const pages = {overview:'Genel Bakış',institutions:'Kurumlar',staff:'Personel Havuzu',tariffs:'Yıllık Tarifeler',payments:'Ödeme Dönemi'};
let db = {institutions:[],staff:[],tariffs:[],years:[],batches:[]};
let page = 'overview', activeYear = YEAR_NOW, selectedInstitution = '', payMode = 'Nakdi';
const $ = (s,root=document)=>root.querySelector(s), $$=(s,root=document)=>[...root.querySelectorAll(s)];
const esc = v => String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const id = () => crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const money = n => new Intl.NumberFormat('tr-TR',{style:'currency',currency:'TRY'}).format(Number(n)||0);
const dateText = s => s ? new Date(s+'T12:00:00').toLocaleDateString('tr-TR') : '—';
async function load(){try{const r=await fetch('/api/data');db=await r.json();if(!db.years.some(x=>Number(x.year)===YEAR_NOW)){db.years.push({year:YEAR_NOW,incomeTax:'',stampTax:''});await save()}}catch(e){showToast('Yerel veri sunucusuna ulaşılamadı. Baslat.bat dosyasını yeniden çalıştırın.')}}
async function save(){const r=await fetch('/api/data',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(db)});if(!r.ok)throw new Error('Kayıt başarısız');}
function toast(s){const el=$('#toast');el.textContent=s;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2500)}
function showToast(s){setTimeout(()=>toast(s),50)}
function setPage(p){page=p;$$('.nav').forEach(b=>b.classList.toggle('active',b.dataset.page===p));$('#pageTitle').textContent=pages[p];$('#yearBadge').textContent=`YIL · ${activeYear}`;render()}
function nav(){ $$('.nav').forEach(b=>b.addEventListener('click',()=>setPage(b.dataset.page))); }
const instName = x => db.institutions.find(i=>i.id===x)?.name||'Kurum seçilmemiş';
// [temizlendi] eski render() tanimi
function overview(){let count=db.staff.filter(s=>s.active!==false).length, activeInst=db.institutions.length, t=db.tariffs.filter(x=>Number(x.year)===Number(activeYear)).length, batches=db.batches.filter(x=>Number(x.year)===Number(activeYear));let total=batches.reduce((a,b)=>a+(b.totalNet||0),0);return `<div class="hero"><h2>Giyecek yardımı işlemleriniz tek yerde.</h2><p>Personel havuzunu yönetin, ilgili yılın tarifesini tanımlayın ve kurum seçerek ayni/nakdi ödeme listelerini hazırlayın.</p></div><div class="stats"><div class="stat"><div class="label">KAYITLI AKTİF PERSONEL</div><strong>${count}</strong><em>Tüm bağlı kurumlar</em></div><div class="stat"><div class="label">KAYITLI KURUM</div><strong>${activeInst}</strong><em>İlçe müdürlüğü ve okullar</em></div><div class="stat"><div class="label">${activeYear} TARİFE KALEMİ</div><strong>${t}</strong><em>Unvan ve giyecek tanımları</em></div><div class="stat"><div class="label">${activeYear} HAZIRLANAN ÖDEME</div><strong>${money(total)}</strong><em>${batches.length} ödeme listesi</em></div></div><div class="grid2"><div class="card"><div class="cardhead"><div><h2>Hızlı başlangıç</h2><p>İlk kullanımda şu sırayı izleyin</p></div></div><div class="tablewrap"><table><thead><tr><th>Adım</th><th>İşlem</th><th>Durum</th></tr></thead><tbody><tr><td>01</td><td>Kurumları tanımlayın</td><td>${db.institutions.length?'<span class="badge">Hazır</span>':'<span class="badge amber">Bekliyor</span>'}</td></tr><tr><td>02</td><td>Personel havuzunu oluşturun</td><td>${count?'<span class="badge">Hazır</span>':'<span class="badge amber">Bekliyor</span>'}</td></tr><tr><td>03</td><td>${activeYear} tarife kalemlerini girin</td><td>${t?'<span class="badge">Hazır</span>':'<span class="badge amber">Bekliyor</span>'}</td></tr><tr><td>04</td><td>Kurum ve ödeme dönemini seçin</td><td>${batches.length?'<span class="badge">Hazır</span>':'<span class="badge amber">Bekliyor</span>'}</td></tr></tbody></table></div></div><div class="card"><div class="cardhead"><div><h2>Son hazırlanan listeler</h2><p>Ödeme dönemi kayıtları</p></div><button class="btn secondary" data-goto="payments">Tümünü gör</button></div>${batches.length?tableBatches(batches.slice().reverse().slice(0,4)):'<div class="empty">Henüz ödeme listesi oluşturulmadı.</div>'}</div></div><div class="callout">Yıllık fiyat ve kullanım süreleri genelgeye göre değişebilir. Tarifeyi her yıl gözden geçirin; hesaplama öncesi doğru yılın fiyatlarını ve uygulanacak vergi oranlarını girin.</div>`}
const INST_TYPES=['İlkokul','Ortaokul','Ortaöğretim','İlçe Millî Eğitim Müdürlüğü','Diğer kurum'];

function instCategory(i){
  const t=String(i&&i.type||'');
  if(INST_TYPES.indexOf(t)>=0)return t;
  const n=String(i&&i.name||'').toLocaleLowerCase('tr');
  if(n.indexOf('ilkokul')>=0)return 'İlkokul';
  if(n.indexOf('ortaokul')>=0)return 'Ortaokul';
  if(n.indexOf('lise')>=0)return 'Ortaöğretim';
  if(n.indexOf('halk eğitim')>=0||n.indexOf('mesleki eğitim')>=0)return 'Diğer kurum';
  if(n.indexOf('ilçe')>=0||n.indexOf('milli eğitim')>=0)return 'İlçe Millî Eğitim Müdürlüğü';
  return 'Diğer kurum';
}

function districtUnit(){
  const i=db.institutions.find(x=>instCategory(x)==='İlçe Millî Eğitim Müdürlüğü');
  return i?i.name:'Sivaslı İlçe Millî Eğitim Müdürlüğü';
}

function institutionsPage(){
  const counts={};INST_TYPES.forEach(t=>counts[t]=0);
  db.institutions.forEach(i=>{const c=instCategory(i);counts[c]=(counts[c]||0)+1});
  const active=db.staff.filter(s=>s.active!==false).length;
  const line=(label,key)=>`<div class="statline"><span>${label}</span><b>${counts[key]||0}</b></div>`;
  return `<div class="split">
    <div class="card">
      <div class="cardhead"><div><h2>Kurum listesi</h2><p>Müdürlük ve bağlı okul/kurum kayıtları</p></div><button class="btn" data-action="add-inst">+ Kurum ekle</button></div>
      ${db.institutions.length
        ? `<div class="tablewrap compact"><table class="inst-table"><thead><tr><th>Kurum adı</th><th>Tür</th><th>Personel</th><th></th></tr></thead><tbody>${db.institutions.map(i=>`<tr><td><b>${esc(i.name)}</b></td><td><span class="badge">${esc(instCategory(i))}</span></td><td>${db.staff.filter(s=>s.institutionId===i.id&&s.active!==false).length}</td><td class="nowrap"><button class="smallbtn" data-action="edit-inst" data-id="${esc(i.id)}">Düzenle</button><button class="smallbtn" data-action="del-inst" data-id="${esc(i.id)}">Sil</button></td></tr>`).join('')}</tbody></table></div>`
        : '<div class="empty">Henüz kurum eklenmemiş. İlk kurumunuzu ekleyerek başlayın.</div>'}
    </div>
    <div class="card stats-card">
      <div class="cardhead"><div><h2>Kurum dağılımı</h2><p>${db.institutions.length} kurum · ${active} aktif personel</p></div></div>
      <div class="statlines">
        ${line('İlkokul','İlkokul')}
        ${line('Ortaokul','Ortaokul')}
        ${line('Ortaöğretim','Ortaöğretim')}
        ${line('Diğer kurum','Diğer kurum')}
        ${line('İlçe idaresi','İlçe Millî Eğitim Müdürlüğü')}
      </div>
      <div class="statlines total"><div class="statline"><span>Toplam kurum</span><b>${db.institutions.length}</b></div></div>
      <p class="hint">Tür bilgisi kurum adından da çıkarılır: İlkokulu, Ortaokulu, Lisesi, Halk/Mesleki Eğitim Merkezi, İlçe Millî Eğitim Müdürlüğü.</p>
    </div>
  </div>`;
}
function staffPage(){let list=db.staff.filter(s=>!selectedInstitution||s.institutionId===selectedInstitution);return `<div class="card"><div class="cardhead"><div><h2>Personel kayıtları</h2><p>Personel havuzu, giyim yardımı hesaplamalarında kullanılacak temel bilgileri tutar.</p></div><div class="actions"><button class="btn secondary" data-action="import-staff">CSV içe aktar</button><button class="btn" data-action="add-staff">+ Personel ekle</button><input type="file" id="csvFile" accept=".csv,text/csv" hidden></div></div><div class="toolbar"><select class="fieldinput" id="filterInstitution"><option value="">Tüm kurumlar</option>${db.institutions.map(i=>`<option value="${esc(i.id)}" ${selectedInstitution===i.id?'selected':''}>${esc(i.name)}</option>`).join('')}</select><input class="fieldinput search" id="staffSearch" placeholder="Ad, unvan veya kurum ara..."></div>${list.length?`<div class="tablewrap"><table id="staffTable"><thead><tr><th>Ad soyad</th><th>Kurum</th><th>Unvan</th><th>Hizmet sınıfı</th><th>Durum</th><th></th></tr></thead><tbody>${list.map(s=>`<tr data-search="${esc((s.name+' '+s.title+' '+instName(s.institutionId)).toLocaleLowerCase('tr'))}"><td><b>${esc(s.name)}</b></td><td>${esc(instName(s.institutionId))}</td><td>${esc(s.title)}</td><td>${esc(s.serviceClass)}</td><td>${s.active===false?'<span class="badge red">Pasif</span>':'<span class="badge">Aktif</span>'}</td><td><button class="smallbtn" data-action="edit-staff" data-id="${esc(s.id)}">Düzenle</button> <button class="smallbtn" data-action="del-staff" data-id="${esc(s.id)}">Sil</button></td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">Bu ölçütlerde personel yok. CSV ile içe aktarabilir veya elle ekleyebilirsiniz.</div>'}<div class="callout green">CSV başlıkları: <b>Ad Soyad, Kurum, Unvan, Hizmet Sınıfı</b>. Dosyanız UTF-8 veya Türkçe Windows kodlamasında olabilir. T.C. kimlik numarası uygulama tarafından istenmez.</div></div>`}
function tariffsPage(){let yearRow=db.years.find(x=>Number(x.year)===Number(activeYear))||{year:activeYear,incomeTax:'',stampTax:''}, rows=db.tariffs.filter(t=>Number(t.year)===Number(activeYear));return `<div class="toolbar"><div class="field" style="margin:0"><label>Tarife yılı</label><select id="yearSelect">${yearOptions()}</select></div><button class="btn" data-action="add-tariff">+ Tarife kalemi ekle</button><button class="btn secondary right" data-action="backup">Yedek al</button><button class="btn secondary" data-action="restore">Yedek yükle</button><button class="btn secondary" data-action="open-backups">Yedek klasörü</button><input type="file" id="backupFile" accept=".json,application/json" hidden></div><div class="card"><div class="cardhead"><div><h2>${activeYear} yılı uygulama ayarları</h2><p>Nakdi ödeme hesaplarında kullanılacak oranlar ve genelge kaydı</p></div><button class="btn light" data-action="save-year">Ayarları kaydet</button></div><div class="formgrid"><div class="field"><label>Gelir vergisi kesinti oranı (%)</label><input type="number" id="incomeTax" min="0" max="100" step="0.01" value="${esc(yearRow.incomeTax)}" placeholder="Uygulanacak oranı girin"></div><div class="field"><label>Damga vergisi kesinti oranı (%)</label><input type="number" id="stampTax" min="0" max="100" step="0.001" value="${esc(yearRow.stampTax)}" placeholder="Uygulanacak oranı girin"></div><div class="field wide"><label>Genelge / kaynak notu</label><input id="yearSource" value="${esc(yearRow.source||'')}" placeholder="Örn. HMB 2026/4 Sıra No’lu Genelge, 08.01.2026"></div></div><p class="hint">Bu oranlar için uygulamanızda esas aldığınız bordro/mevzuat oranlarını girin. Uygulama, girilen oranları brüt nakdi giyecek tutarına uygular; oranı kendiliğinden tahmin etmez.</p></div><div class="card"><div class="cardhead"><div><h2>Yardım tarifesi</h2><p>Unvan ve hizmet sınıfı bazında giyecek kalemleri, brüt tutar ve tekrar süresi</p></div><span class="badge">${rows.length} kalem</span></div>${rows.length?`<div class="tablewrap"><table><thead><tr><th>Unvan</th><th>Hizmet sınıfı</th><th>Giyecek</th><th>Yardım türü</th><th>Birim tutarı</th><th>Kullanım süresi</th><th></th></tr></thead><tbody>${rows.map(t=>`<tr><td>${esc(t.title)}</td><td>${esc(t.serviceClass||'Tüm sınıflar')}</td><td><b>${esc(t.item)}</b></td><td><span class="badge ${t.mode==='Ayni'?'amber':''}">${esc(t.mode)}</span></td><td class="money">${money(t.amount)}</td><td>${t.years} yıl</td><td><button class="smallbtn" data-action="del-tariff" data-id="${esc(t.id)}">Sil</button></td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">Bu yıl için tarife yok. Genelgedeki uygun kalemleri ekleyin.</div>'}</div>`}
function yearOptions(){let ys=[...new Set([...db.years.map(x=>Number(x.year)),...db.tariffs.map(x=>Number(x.year)),YEAR_NOW,activeYear])].sort((a,b)=>b-a);return ys.map(y=>`<option value="${y}" ${Number(activeYear)===y?'selected':''}>${y}</option>`).join('')}
function paymentsPage(){let insts=db.institutions, list=db.batches.filter(b=>Number(b.year)===Number(activeYear));return `<div class="card"><div class="cardhead"><div><h2>Yeni ödeme dönemi hazırla</h2><p>Yıl ve kurum seçin; program tarife ve önceki ödeme geçmişine göre ödenecek personeli çıkarır.</p></div></div><div class="toolbar"><div class="field" style="margin:0"><label>Yardım yılı</label><select id="paymentYear">${yearOptions()}</select></div><div class="field" style="margin:0;min-width:260px"><label>Kurum</label><select id="paymentInstitution"><option value="">Kurum seçin</option>${insts.map(i=>`<option value="${esc(i.id)}" ${selectedInstitution===i.id?'selected':''}>${esc(i.name)}</option>`).join('')}</select></div><button class="btn" data-action="calculate">Ödemeye uygunları hesapla</button></div><div class="hint">Aynı personel ve giyecek kalemi için önceki ödeme, tarifedeki kullanım süresi dolmadan yeniden önerilmez. Hazırlanan listenin resmî ödeme öncesinde kontrol edilmesi gerekir.</div></div><div id="calcResult"></div><div class="card"><div class="cardhead"><div><h2>${activeYear} kayıtlı ödeme listeleri</h2><p>Hazırlanmış nakdi ve ayni listeler</p></div></div>${list.length?tableBatches(list.slice().reverse()):'<div class="empty">Seçilen yıl için liste yok.</div>'}</div>`}
function tableBatches(rows){
  return `<div class="tablewrap"><table><thead><tr><th>Tarih</th><th>Kurum</th><th>Yıl</th><th>Kişi</th><th>Net toplam</th><th></th></tr></thead><tbody>${rows.map(b=>`<tr><td>${dateText(b.date)}</td><td>${esc(instName(b.institutionId))}</td><td>${b.year}</td><td>${b.details.length}</td><td class="money"><b>${money(b.totalNet)}</b></td><td class="nowrap"><button class="smallbtn" data-action="view-batch" data-id="${esc(b.id)}">Görüntüle</button><button class="smallbtn" data-action="edit-batch" data-id="${esc(b.id)}">Güncelle</button><button class="smallbtn" data-action="del-batch" data-id="${esc(b.id)}">Sil</button></td></tr>`).join('')}</tbody></table></div>`;
}
function modal(title,sub,content,submitLabel='Kaydet'){const d=$('#modal');$('#modalBody').innerHTML=`<h2>${title}</h2><p class="dialog-sub">${sub}</p>${content}<div class="dialog-actions"><button class="btn secondary" value="cancel" formnovalidate>Vazgeç</button><button class="btn" id="modalSave" value="default">${submitLabel}</button></div>`;d.showModal();return d}
function field(label,name,placeholder='',type='text',value=''){return `<div class="field"><label>${label}</label><input name="${name}" type="${type}" placeholder="${placeholder}" value="${esc(value)}" required></div>`}
// [temizlendi] eski bindPage() tanimi
// [temizlendi] eski action() tanimi
function addInst(){
  const opts=INST_TYPES.map(t=>`<option>${esc(t)}</option>`).join('');
  const d=modal('Kurum ekle','Müdürlük veya bağlı kurum kaydı oluşturun.',`<div class="formgrid">${field('Kurum adı','name','Örn. Atatürk Ortaokulu')}<div class="field"><label>Kurum türü</label><select name="type">${opts}</select></div></div>`);
  $('#modalSave').onclick=async e=>{
    e.preventDefault();
    const f=new FormData($('#modalForm'));
    const name=String(f.get('name')||'').trim();
    if(!name)return;
    db.institutions.push({id:id(),name,type:f.get('type')});
    await save();d.close();render();toast('Kurum eklendi.');
  };
}

function editInst(key){
  const it=db.institutions.find(x=>x.id===key);if(!it)return;
  const current=instCategory(it);
  const opts=INST_TYPES.map(t=>`<option ${t===current?'selected':''}>${esc(t)}</option>`).join('');
  const d=modal('Kurumu düzenle','Kurum bilgilerini güncelleyin.',`<div class="formgrid">${field('Kurum adı','name','Örn. Atatürk Ortaokulu','text',it.name)}<div class="field"><label>Kurum türü</label><select name="type">${opts}</select></div></div>`);
  $('#modalSave').onclick=async e=>{
    e.preventDefault();
    const f=new FormData($('#modalForm'));
    const name=String(f.get('name')||'').trim();
    if(!name){toast('Kurum adı zorunlu.');return}
    it.name=name;it.type=f.get('type');
    await save();d.close();render();toast('Kurum güncellendi.');
  };
}
// [temizlendi] eski addStaff() tanimi
function addTariff(){let d=modal('Tarife kalemi ekle',`${activeYear} yılı için genelgedeki bir giyecek/yardım hakkını tanımlayın.`, `<div class="formgrid">${field('Kadro unvanı','title','Örn. Şoför')}<div class="field"><label>Hizmet sınıfı (boş = tümü)</label><select name="serviceClass"><option value="">Tüm hizmet sınıfları</option>${classes.map(c=>`<option>${esc(c)}</option>`).join('')}</select></div>${field('Giyecek kalemi','item','Örn. Ayakkabı')}<div class="field"><label>Yardım türü</label><select name="mode"><option>Nakdi</option><option>Ayni</option></select></div>${field('Birim tutarı (TL)','amount','Örn. 320,98','number')}<div class="field"><label>Kullanım süresi (yıl)</label><input name="years" type="number" min="1" step="1" value="1" required></div></div><p class="hint">Nakdi yardım için genelgedeki azami birim fiyatı, ayni yardım için kurumunuzun uygulayacağı fiyatı girin.</p>`);$('#modalSave').onclick=async e=>{e.preventDefault();let f=new FormData($('#modalForm')), amount=Number(f.get('amount')), years=Number(f.get('years'));if(!f.get('title').trim()||!f.get('item').trim()||amount<0||years<1)return;db.tariffs.push({id:id(),year:activeYear,title:f.get('title').trim(),serviceClass:f.get('serviceClass'),item:f.get('item').trim(),mode:f.get('mode'),amount,years});await save();d.close();render();toast('Tarife kalemi eklendi.')}}
function deleteRow(collection,key,msg){if(!confirm(msg))return;db[collection]=db[collection].filter(x=>x.id!==key);save().then(()=>{render();toast('Kayıt silindi.')})}
async function saveYear(){let y=db.years.find(x=>Number(x.year)===Number(activeYear))||{year:activeYear};y.incomeTax=$('#incomeTax').value;y.stampTax=$('#stampTax').value;y.source=$('#yearSource').value; if(!db.years.some(x=>Number(x.year)===Number(activeYear)))db.years.push(y);else db.years=db.years.map(x=>Number(x.year)===Number(activeYear)?y:x);await save();toast('Yıl ayarları kaydedildi.')}
function paymentHistory(personId,item){return db.batches.flatMap(b=>b.details||[]).filter(d=>d.staffId===personId&&d.item===item&&d.paid!==false).map(d=>Number(d.year)).sort((a,b)=>b-a)}
// [temizlendi] eski calculate() tanimi
function tableDue(rows){if(!rows.length)return '<div class="empty">Bu yardım türünde ödeme önerilecek giyecek kalemi bulunmuyor.</div>';return `<div class="tablewrap"><table><thead><tr><th>Ad soyad</th><th>Unvan</th><th>Giyecek</th><th>Brüt</th><th>Gelir vergisi</th><th>Damga vergisi</th><th>Net</th><th>Tekrar</th></tr></thead><tbody>${rows.map(d=>`<tr><td>${esc(d.staffName)}</td><td>${esc(d.title)}</td><td><b>${esc(d.item)}</b></td><td class="money">${money(d.amount)}</td><td class="money">${money(d.incomeTax)}</td><td class="money">${money(d.stampTax)}</td><td class="money"><b>${money(d.net)}</b></td><td>${d.years} yıl</td></tr>`).join('')}</tbody></table></div>`}
// [temizlendi] eski saveBatch() tanimi
// [temizlendi] eski viewBatch() tanimi
// [temizlendi] eski downloadCsv() tanimi
function backup(){let a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(db,null,2)],{type:'application/json'}));a.download=`Giyim_Yardimi_Yedek_${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(a.href);toast('Yedek dosyası indirildi.')}
function csvParse(text){let rows=[],row=[],cell='',q=false;for(let i=0;i<text.length;i++){let c=text[i];if(c==='"'&&q&&text[i+1]==='"'){cell+='"';i++}else if(c==='"')q=!q;else if((c===';'||c===',')&&!q){row.push(cell);cell=''}else if((c==='\n'||c==='\r')&&!q){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(x=>x.trim()))rows.push(row);row=[];cell=''}else cell+=c}row.push(cell);if(row.some(x=>x.trim()))rows.push(row);return rows}
function norm(s){return String(s||'').trim().toLocaleLowerCase('tr').replace(/[ıİ]/g,'i').normalize('NFD').replace(/[\u0300-\u036f]/g,'')}
// [temizlendi] eski importCsv() tanimi
// [temizlendi] eski bindGlobal() tanimi
// [temizlendi] eski init() tanimi
// Enhancements loaded with the first MVP: keep file controls wired after page switches.
// [temizlendi] eski render() tanimi
// [temizlendi] eski bindPage() tanimi
// [temizlendi] eski action() tanimi
function csvText(file){return file.arrayBuffer().then(buf=>{try{return new TextDecoder('utf-8',{fatal:true}).decode(buf)}catch{return new TextDecoder('windows-1254').decode(buf)}})}
async function importTariffs(file){const rows=csvParse(await csvText(file));if(rows.length<2){toast('CSV dosyasında tarife satırı yok.');return}const hs=rows[0].map(norm),find=(...n)=>n.map(x=>hs.indexOf(norm(x))).find(i=>i>=0),ix={year:find('Yıl','Yardım Yılı'),title:find('Unvan','Kadro Unvanı'),cls:find('Hizmet Sınıfı'),item:find('Giyecek Kalemi','Giyecek'),mode:find('Yardım Türü','Tür'),amount:find('Birim Tutarı TL','Birim Tutarı'),years:find('Kullanım Süresi Yıl','Kullanım Süresi')};if(Object.values(ix).some(x=>x===undefined)){toast('Tarife CSV başlıkları uygun değil. CSV şablonunu indirin.');return}let added=0;for(const r of rows.slice(1)){const title=(r[ix.title]||'').trim(),item=(r[ix.item]||'').trim(),mode=(r[ix.mode]||'').trim(),amount=Number(String(r[ix.amount]||'').replace(',','.')),year=Number(r[ix.year]||activeYear),years=Number(r[ix.years]||1),serviceClass=(r[ix.cls]||'').trim();if(!title||!item||!['Nakdi','Ayni'].includes(mode)||!Number.isFinite(amount)||amount<0||!Number.isFinite(year)||years<1)continue;db.tariffs.push({id:id(),year,title,serviceClass,item,mode,amount,years});added++}await save();render();toast(`${added} tarife kalemi içe aktarıldı.`)}
function tariffTemplate(){const csv='\ufeffYıl;Unvan;Hizmet Sınıfı;Giyecek Kalemi;Yardım Türü;Birim Tutarı TL;Kullanım Süresi Yıl\r\n';const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.download='Giyecek_Tarife_Sablonu.csv';a.click();URL.revokeObjectURL(a.href)}
async function restoreBackup(file){try{const x=JSON.parse(await file.text());if(!Array.isArray(x.staff)||!Array.isArray(x.institutions)||!Array.isArray(x.tariffs)||!Array.isArray(x.batches)||!Array.isArray(x.years))throw 0;if(!confirm('Yedek yüklenecek ve mevcut kayıtların üzerine yazılacak. Devam edilsin mi?'))return;db=x;await save();render();toast('Yedek yüklendi.')}catch{toast('Yedek dosyası okunamadı.')}}
// [temizlendi] eski saveBatch() tanimi
async function bindGlobal(){const root=$('#page');root.addEventListener('change',async e=>{const f=e.target.files?.[0];if(!f)return;if(e.target.id==='csvFile')await importCsv(f);if(e.target.id==='tariffFile')await importTariffs(f);if(e.target.id==='backupFile')await restoreBackup(f);e.target.value=''})}
// [temizlendi] eski init() tanimi

function addStaff(){if(!db.institutions.length){toast('Önce kurum ekleyin.');return setPage('institutions')}const d=modal('Personel ekle','Kişisel kimlik bilgisi zorunlu değildir; T.C. kimlik numarasını yalnızca çıktı için gerekiyorsa girin.',`<div class="formgrid">${field('Ad soyad','name','Ad Soyad')}<div class="field"><label>Kurum</label><select name="institutionId" required>${db.institutions.map(i=>`<option value="${esc(i.id)}">${esc(i.name)}</option>`).join('')}</select></div>${field('Kadro unvanı','title','Örn. Hizmetli')}<div class="field"><label>Hizmet sınıfı</label><select name="serviceClass">${classes.map(c=>`<option>${esc(c)}</option>`).join('')}</select></div>${field('T.C. kimlik numarası (isteğe bağlı)','nationalId','11 haneli numara','text')}<div class="field"><label>Durum</label><select name="active"><option value="true">Aktif</option><option value="false">Pasif</option></select></div></div><p class="hint">Bu bilgisayarın yerel veritabanında saklanır. Yedek dosyası oluşturulduğunda bu bilgi de yedeğe girer.</p>`);$('#modalSave').onclick=async e=>{e.preventDefault();const f=new FormData($('#modalForm')),tc=String(f.get('nationalId')||'').trim();if(!f.get('name').trim()||!f.get('title').trim())return;if(tc&&(!/^\d{11}$/.test(tc))){toast('T.C. kimlik numarası 11 rakam olmalıdır.');return}db.staff.push({id:id(),name:f.get('name').trim(),institutionId:f.get('institutionId'),title:f.get('title').trim(),serviceClass:f.get('serviceClass'),nationalId:tc,active:f.get('active')==='true'});await save();d.close();render();toast('Personel eklendi.')}}
async function importCsv(file){const rows=csvParse(await csvText(file));if(rows.length<2){toast('CSV dosyasında veri satırı yok.');return}const headers=rows[0].map(norm),find=(...names)=>names.map(x=>headers.indexOf(norm(x))).find(i=>i>=0),ix={name:find('Ad Soyad','Adı Soyadı','Ad Soyadi'),inst:find('Kurum','Okul','Kurum Adı'),title:find('Unvan','Kadro Unvanı','Ünvan'),cls:find('Hizmet Sınıfı','Sınıf'),tc:find('T.C. Kimlik No','TC Kimlik No','T.C.')};if([ix.name,ix.inst,ix.title,ix.cls].some(x=>x===undefined)){toast('CSV başlıklarını kontrol edin: Ad Soyad, Kurum, Unvan, Hizmet Sınıfı');return}let n=0;for(const r of rows.slice(1)){const name=(r[ix.name]||'').trim(),institution=(r[ix.inst]||'').trim(),title=(r[ix.title]||'').trim(),serviceClass=(r[ix.cls]||'').trim(),tc=ix.tc===undefined?'':(r[ix.tc]||'').trim();if(!name||!institution||!title)continue;let ins=db.institutions.find(x=>norm(x.name)===norm(institution));if(!ins){ins={id:id(),name:institution,type:'Okul'};db.institutions.push(ins)}if(db.staff.some(s=>norm(s.name)===norm(name)&&s.institutionId===ins.id&&norm(s.title)===norm(title)))continue;db.staff.push({id:id(),name,institutionId:ins.id,title,serviceClass:classes.includes(serviceClass)?serviceClass:'Diğer',nationalId:/^\d{11}$/.test(tc)?tc:'',active:true});n++}await save();render();toast(`${n} personel kaydı içe aktarıldı.`)}
// [temizlendi] eski saveBatch() tanimi
// [temizlendi] eski viewBatch() tanimi
// [temizlendi] eski init() tanimi
document.addEventListener('click',e=>{if(['exportCash','exportAyni','printReport'].includes(e.target.id))e.preventDefault()});

function downloadCsv(batch,mode){const rows=batch.details.filter(d=>d.mode===mode),head=mode==='Nakdi'?['Yardım Yılı','Kurum','Ad Soyad','Unvan','Hizmet Sınıfı','T.C. Kimlik No','Giyecek Kalemi','Brüt Tutar (TL)','Gelir Vergisi Kesintisi (TL)','Damga Vergisi Kesintisi (TL)','Net Tutar (TL)','Kullanım Süresi (Yıl)']:['Yardım Yılı','Kurum','Ad Soyad','Unvan','Hizmet Sınıfı','T.C. Kimlik No','Giyecek Kalemi','Birim Değeri (TL)','Kullanım Süresi (Yıl)'];const data=rows.map(d=>{const tc=db.staff.find(s=>s.id===d.staffId)?.nationalId||'';return mode==='Nakdi'?[d.year,instName(batch.institutionId),d.staffName,d.title,d.serviceClass,tc,d.item,d.amount.toFixed(2),d.incomeTax.toFixed(2),d.stampTax.toFixed(2),d.net.toFixed(2),d.years]:[d.year,instName(batch.institutionId),d.staffName,d.title,d.serviceClass,tc,d.item,d.amount.toFixed(2),d.years]});const csv='\ufeff'+[head,...data].map(r=>r.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(';')).join('\r\n'),a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.download=`Giyecek_${mode}_${batch.year}.csv`;a.click();URL.revokeObjectURL(a.href)}

// Year-based item catalogue and person-by-person payment selection.
const prices2026=[
 ['Takım Elbise',1034.08,1137.49],['Tayyör',753.74,829.12],['Yazlık Takım Elbise',1025.25,1127.77],['Ceket',813.63,894.99],['Pantolon-Etek',219.10,241.01],['Gömlek-Bluz-Yelek-Tişört',141.53,155.69],['Kravat-Papyon',39.76,43.74],['Palto-Manto',1034.08,1137.49],['Pardesü-Gocuk',510.13,561.15],['Yağmurluk (Mușamba)',224.33,246.77],['Meşin Ceket-Deri Ceket',928.88,1021.77],['Parka-Mont-Montgomer',459.23,505.16],['Kaput',281.43,309.58],['Erkek Ayakkabısı',291.80,320.98],['Kadın Ayakkabısı',291.80,320.98],['İş Ayakkabısı',203.35,223.69],['Bot-Fotin',291.80,320.98],['Lastik Çizme',106.06,116.67],['Çorap',19.96,21.96],['Eldiven (Yün)',25.48,28.03],['Eldiven (Deri)',76.92,84.62],['Atkı-Kaşkol',39.76,43.74],['Kazak',159.52,175.48],['Sarık veya Başörtüsü',79.15,87.07],['Cüppe',236.64,260.31],['Şapka-Başlık-Kep-Bere',77.66,85.43],['İş Gömleği',104.32,114.76],['İş Önlüğü',104.32,114.76],['Ebe Önlüğü',104.32,114.76],['İş Elbisesi',291.80,320.98],['Tulum',198.94,218.84],['Hemşire-Ebe Forması',224.33,246.77],['Laboratuvar Kıyafeti',162.95,179.25],['Ameliyathane Kıyafeti',162.95,179.25],['Bel Kemeri-Palaska',86.88,95.58],['Baret',197.83,217.62],['İçlik',151.06,166.17],['Teçhizat Takımı',151.06,166.17]
];
pages.tariffs='Yıllık Fiyat Listesi';
function priceRows(year=activeYear){return db.tariffs.filter(t=>Number(t.year)===Number(year))}
function uniqueItems(year=activeYear){return [...new Set(priceRows(year).map(t=>t.item))]}
function priceFor(item,mode,year=activeYear){return priceRows(year).find(t=>t.item===item&&t.mode===mode)}
async function seedPrice2026(){if(db.tariffs.some(t=>Number(t.year)===2026))return;for(const [item,ayni,nakdi] of prices2026){db.tariffs.push({id:id(),year:2026,item,mode:'Ayni',amount:ayni,years:0,source:'Ek-1'});db.tariffs.push({id:id(),year:2026,item,mode:'Nakdi',amount:nakdi,years:0,source:'Ek-2'})}if(!db.years.some(y=>Number(y.year)===2026))db.years.push({year:2026,incomeTax:'',stampTax:'',source:'Hazine ve Maliye Bakanlığı Giyecek Yardımı Genelgesi (2026), Ek-1 ve Ek-2'});await save()}
// [temizlendi] eski render() tanimi
function yearCatalogPage(){
  const items=uniqueItems();
  const data=items.map(item=>({item,ayni:priceFor(item,'Ayni'),nakdi:priceFor(item,'Nakdi')}));
  return `<div class="toolbar">
    <div class="field" style="margin:0"><label>Fiyat yılı</label><select id="yearSelect">${yearOptions()}</select></div>
    <div class="field" style="margin:0"><label>Kalem ara</label><input id="catalogSearch" placeholder="Giyecek adı…"></div>
    <button class="btn secondary" data-action="import-tariff-pdf">PDF sayfalarını içe aktar</button>
    <input type="file" id="tariffPdfFiles" accept="application/pdf,.pdf" multiple hidden>
    <button class="btn secondary right" data-action="new-year">Yeni yıl oluştur</button>
  </div>
  <div class="card">
    <div class="cardhead"><div><h2>${activeYear} yılı azami birim fiyatları</h2><p>Giyecek kalemleri Bakanlık PDF’lerinden içe aktarılır; tutarları buradan güncelleyebilirsiniz.</p></div><span class="badge" id="catalogCount">${items.length} kalem</span></div>
    ${items.length?`<div class="tablewrap catalog-wrap"><table class="catalog-table" id="catalogTable"><thead><tr><th>Giyecek kalemi</th><th>Nakdi birim fiyatı</th><th>Ayni azami fiyatı</th><th></th></tr></thead><tbody>${data.map(x=>`<tr data-search="${esc(norm(x.item))}"><td><b>${esc(x.item)}</b></td><td class="money">${x.nakdi?money(x.nakdi.amount):'—'}</td><td class="money">${x.ayni?money(x.ayni.amount):'—'}</td><td class="nowrap"><button class="smallbtn" data-action="edit-price" data-item="${esc(x.item)}">Düzenle</button><button class="smallbtn" data-action="del-price" data-item="${esc(x.item)}">Sil</button></td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">Bu yıl için fiyat listesi yok. “PDF sayfalarını içe aktar” ile Bakanlık listesini yükleyin veya yeni yıl oluşturun.</div>'}
    <div class="callout green">Fiyatlar yıllık genelgedeki azami birim tutarlardır. Yeni yıl oluşturduğunuzda önceki yılın kalemleri kopyalanır; yeni genelge tutarlarını güncelleyin.</div>
  </div>`;
}
function manualPaymentsPage(){const institutions=db.institutions;const batches=db.batches.filter(b=>Number(b.year)===Number(activeYear));return `<div class="card"><div class="cardhead"><div><h2>Ödeme dönemi ve kurum</h2><p>Ödeme yılını seçin, ardından kurumu seçerek personel listesine geçin.</p></div></div><div class="toolbar"><div class="field" style="margin:0"><label>Ödeme yılı</label><select id="paymentYear">${yearOptions()}</select></div><div class="field" style="margin:0;min-width:280px"><label>Kurum seçin</label><select id="paymentInstitution"><option value="">Kurum seçin</option>${institutions.map(x=>`<option value="${esc(x.id)}" ${x.id===selectedInstitution?'selected':''}>${esc(x.name)}</option>`).join('')}</select></div><span class="badge">${priceRows().length?`${uniqueItems().length} giyecek kalemi hazır`:'Fiyat listesi yok'}</span></div><div class="hint">Kurum seçince bağlı personeller görünür. Personeli işaretleyip verilecek ayni/nakdi giyecek kalemlerini seçin.</div></div><div id="peopleList"></div><div id="calcResult"></div><div class="card"><div class="cardhead"><div><h2>${activeYear} kayıtlı ödeme listeleri</h2><p>Önceden hazırlanmış kurum listeleri</p></div></div>${batches.length?tableBatches(batches.slice().reverse()):'<div class="empty">Bu yıl için ödeme listesi kaydedilmedi.</div>'}</div>`}
function drawRoster(){
  const root=$('#peopleList');if(!root)return;
  if(!selectedInstitution){root.innerHTML='<div class="card empty">Önce kurum seçin. Kuruma kayıtlı tüm aktif personeller burada listelenecek.</div>';return}
  const staff=db.staff.filter(s=>s.institutionId===selectedInstitution&&s.active!==false);
  if(!staff.length){root.innerHTML='<div class="card empty">Bu kuruma henüz aktif personel kaydedilmemiş.</div>';return}
  root.innerHTML=`<div class="card"><div class="cardhead"><div><h2>${esc(instName(selectedInstitution))} · Personel seçimi</h2><p>${staff.length} aktif personel. Kutucuk yalnızca seçim yapar; yardım kalemleri için kişi adına tıklayın.</p></div><button class="btn" data-action="calculate">Seçimleri hesapla</button></div>
  <div class="person-list">${staff.map(s=>{
    const st=window.paymentSelection?.[s.id]||{selected:false,items:{}};
    const picked=Object.entries(st.items||{}).filter(([,q])=>q&&q.checked);
    const total=picked.reduce((a,[item,q])=>{const p=priceFor(item,q.mode);return a+(p?p.amount*(Number(q.quantity)||1):0)},0);
    return `<div class="person-row${st.selected?' on':''}">
      <label class="person-pick"><input type="checkbox" data-person-check="${esc(s.id)}" ${st.selected?'checked':''}></label>
      <button class="person-name-btn" type="button" data-person-open="${esc(s.id)}">${esc(s.name)}</button>
      <span class="badge">${esc(s.title)}</span>
      <span class="person-class">${esc(s.serviceClass||'')}</span>
      <span class="person-sum">${picked.length?`${picked.length} kalem · ${money(total)}`:'yardım girilmedi'}</span>
    </div>`}).join('')}</div>
  <div class="callout">Kişi adına tıklayarak giyecek kalemlerini ekleyip çıkarabilirsiniz. Kutucuk yalnızca kişiyi ödeme listesine dahil eder. T.C. kimlik numarası dağıtım listesi çıktısı için personel kaydından gelir.</div></div>`;
  bindRoster();
}

function bindRoster(){
  const root=$('#peopleList');if(!root)return;
  root.onchange=e=>{
    const t=e.target;
    if(!t.matches('[data-person-check]'))return;
    const sid=t.dataset.personCheck;
    const rec=window.paymentSelection[sid]||(window.paymentSelection[sid]={selected:false,items:{}});
    rec.selected=t.checked;
    const row=t.closest('.person-row');
    if(row)row.classList.toggle('on',t.checked);
  };
  root.onclick=e=>{
    const open=e.target.closest('[data-person-open]');
    if(open)openPerson(open.dataset.personOpen);
  };
}

function openPerson(sid){
  const s=db.staff.find(x=>x.id===sid);if(!s)return;
  const d=modal('Yardım bilgileri',`${esc(s.name)} · ${esc(s.title||'')} · ${esc(instName(s.institutionId))}`,`<div id="personPanel">${personItemTable(sid)}</div>`,'Kapat');
  bindPersonPanel($('#personPanel'),sid);
  d.addEventListener('close',()=>drawRoster(),{once:true});
}

function bindPersonPanel(root,sid){
  if(!root)return;
  const refresh=()=>{root.innerHTML=personItemTable(sid);bindPersonPanel(root,sid);drawRoster()};
  root.onclick=e=>{
    const add=e.target.closest('[data-pick-add]');
    if(add){
      const item=root.querySelector('[data-pick-item]').value;
      const mode=root.querySelector('[data-pick-mode]').value;
      const qty=Math.max(1,Number(root.querySelector('[data-pick-qty]').value)||1);
      if(!item){toast('Önce giyecek kalemi seçin.');return}
      const rec=window.paymentSelection[sid]||(window.paymentSelection[sid]={selected:true,items:{}});
      rec.items[item]={checked:true,mode,quantity:qty};
      refresh();
      return;
    }
    const del=e.target.closest('[data-pick-remove]');
    if(del){
      const rec=window.paymentSelection[sid];
      if(rec&&rec.items)delete rec.items[del.dataset.pickRemove];
      refresh();
    }
  };
}
function personItemTable(staffId){
  const items=uniqueItems();
  if(!items.length)return '<div class="empty">Bu yılın giyecek fiyat listesi boş. Önce Yıllık Fiyat Listesi sayfasını tamamlayın.</div>';
  const st=window.paymentSelection[staffId]||{selected:true,items:{}};
  const picked=Object.entries(st.items).filter(([,q])=>q&&q.checked);
  const total=picked.reduce((a,[item,q])=>{const p=priceFor(item,q.mode);return a+(p?p.amount*(Number(q.quantity)||1):0)},0);
  const opt=items.map(i=>{const n=priceFor(i,'Nakdi'),a=priceFor(i,'Ayni');const pr=[n?('Nakdi '+money(n.amount)):'',a?('Ayni '+money(a.amount)):''].filter(Boolean).join(' · ');return `<option value="${esc(i)}">${esc(i)}${pr?' — '+pr:''}</option>`}).join('');
  return `<div class="person-items">
    <div class="chooser-title">Verilecek giyecek ekle</div>
    <div class="item-picker">
      <select data-pick-item data-staff="${esc(staffId)}"><option value="">Giyecek kalemi seçin…</option>${opt}</select>
      <select data-pick-mode data-staff="${esc(staffId)}"><option value="Nakdi">Nakdi</option><option value="Ayni">Ayni</option></select>
      <input type="number" min="1" step="1" value="1" data-pick-qty data-staff="${esc(staffId)}" title="Adet">
      <button class="btn" type="button" data-pick-add data-staff="${esc(staffId)}">Ekle</button>
    </div>
    ${picked.length?`<table class="person-table picked-table"><thead><tr><th>Giyecek</th><th>Tür</th><th>Adet</th><th>Birim fiyat</th><th>Toplam</th><th></th></tr></thead><tbody>${picked.map(([item,q])=>{const p=priceFor(item,q.mode);return `<tr><td><b>${esc(item)}</b></td><td>${q.mode==='Ayni'?'Ayni':'Nakdi'}</td><td>${Number(q.quantity)||1}</td><td class="money">${p?money(p.amount):'—'}</td><td class="money">${p?money(p.amount*(Number(q.quantity)||1)):'—'}</td><td><button class="smallbtn" type="button" data-pick-remove="${esc(item)}" data-staff="${esc(staffId)}">Kaldır</button></td></tr>`}).join('')}</tbody></table>`:'<div class="empty small">Bu kişiye henüz giyecek eklenmedi. Yukarıdaki listeden seçip “Ekle”ye basın.</div>'}
    <div class="person-total">Bu kişiye yapılacak ödeme: <b>${money(total)}</b></div>
  </div>`;
}
// [tasindi] bu fonksiyon ilgili sayfa blogunda yeniden tanimlandi
function bindPage(){const y=$('#yearSelect');if(y)y.onchange=()=>{activeYear=Number(y.value);render()};const py=$('#paymentYear');if(py)py.onchange=()=>{const n=Number(py.value);if(n!==activeYear){activeYear=n;window.paymentSelection={}}render()};const pi=$('#paymentInstitution');if(pi)pi.onchange=()=>{selectedInstitution=pi.value;window.paymentSelection={};render()};const fi=$('#filterInstitution');if(fi)fi.onchange=()=>{selectedInstitution=fi.value;render()};const search=$('#staffSearch');if(search)search.oninput=()=>$$('#staffTable tbody tr').forEach(r=>r.hidden=!r.dataset.search.includes(search.value.toLocaleLowerCase('tr')));$$('[data-goto]').forEach(b=>b.onclick=()=>setPage(b.dataset.goto));$$('[data-action]').forEach(b=>b.onclick=()=>action(b.dataset.action,b.dataset.id,b.dataset.item));const cs=$('#catalogSearch');if(cs)cs.oninput=()=>{const q=norm(cs.value);$$('#catalogTable tbody tr').forEach(r=>r.hidden=!!q&&!r.dataset.search.includes(q))};const backup=$('#backupFile');if(backup)backup.onchange=async e=>{if(e.target.files[0])await restoreBackup(e.target.files[0]);e.target.value=''};const csv=$('#csvFile');if(csv)csv.onchange=async e=>{if(e.target.files[0])await importCsv(e.target.files[0]);e.target.value=''}}
async function createYear(){const last=Math.max(YEAR_NOW,...db.tariffs.map(t=>Number(t.year)||0));const value=prompt('Yeni fiyat yılı',String(last+1));if(!value)return;const yr=Number(value);if(!Number.isInteger(yr)||yr<2000||yr>2200){toast('Geçerli bir yıl girin.');return}if(db.tariffs.some(t=>Number(t.year)===yr)){toast('Bu yılın fiyat listesi zaten var.');activeYear=yr;return render()}const prior=[...new Set(db.tariffs.map(t=>Number(t.year)).filter(x=>x<yr))].sort((a,b)=>b-a)[0];if(prior)for(const t of priceRows(prior))db.tariffs.push({...t,id:id(),year:yr,source:`${prior} yılından kopyalandı · güncelleyin`});db.years=db.years.filter(x=>Number(x.year)!==yr);db.years.push({year:yr,incomeTax:'',stampTax:'',source:prior?`${prior} yılından kopyalandı · güncelleyin`:'Yeni yıl fiyat listesi'});activeYear=yr;await save();render();toast(prior?`${prior} yılının fiyatları kopyalandı. Yeni tutarları güncelleyin.`:`${yr} yılı oluşturuldu.`)}
async function action(a,key,item){if(a==='open-backups')return openBackups();if(a==='import-tariff-pdf')return importOfficialTariffs();if(a==='new-year')return createYear();if(a==='add-inst')return addInst();if(a==='edit-inst')return editInst(key);if(a==='add-staff')return addStaff();if(a==='edit-staff')return editStaff(key);if(a==='add-tariff')return addPrice();if(a==='edit-price')return editPrice(item);if(a==='del-price')return deletePrice(item);if(a==='copy-prices')return copyPrices();if(a==='del-inst')return deleteRow('institutions',key,'Kurumu silmek istediğinize emin misiniz?');if(a==='del-staff')return deleteRow('staff',key,'Personel kaydını silmek istediğinize emin misiniz?');if(a==='save-year')return saveYear();if(a==='calculate')return calculate();if(a==='view-batch')return viewBatch(key);if(a==='edit-batch')return editBatch(key);if(a==='del-batch')return deleteBatch(key);if(a==='backup')return backup();if(a==='restore')return $('#backupFile')?.click();if(a==='import-staff')return $('#csvFile')?.click()}
function priceEditor(item=''){
  const n=priceFor(item,'Nakdi'),a=priceFor(item,'Ayni');
  const d=modal(item?'Giyecek fiyatını düzenle':'Giyecek kalemi ekle',`${activeYear} fiyat kataloğu · Ek-1 ayni ve Ek-2 nakdi fiyatları ayrı tutulur.`,
    `<div class="formgrid">
      <div class="field wide"><label>Giyecek kalemi</label><input name="item" value="${esc(item)}" ${item?'readonly':''} required></div>
      <div class="field"><label>Nakdi birim fiyatı (TL)</label><input name="nakdi" type="number" min="0" step="0.01" value="${n?esc(n.amount):''}" placeholder="Nakdi fiyat"></div>
      <div class="field"><label>Ayni azami fiyatı (TL)</label><input name="ayni" type="number" min="0" step="0.01" value="${a?esc(a.amount):''}" placeholder="Ayni fiyat"></div>
    </div><p class="hint">Fiyatlar yıllık genelgedeki azami birim tutarlardır. Boş bırakılan tür katalogda görünmez.</p>`);
  $('#modalSave').onclick=async e=>{
    e.preventDefault();
    const f=new FormData($('#modalForm'));
    const name=String(f.get('item')||'').trim();
    const nakdi=String(f.get('nakdi')||'').trim();
    const ayni=String(f.get('ayni')||'').trim();
    if(!name||(!nakdi&&!ayni)){toast('Giyecek adı ve en az bir fiyat girin.');return}
    db.tariffs=db.tariffs.filter(t=>!(Number(t.year)===Number(activeYear)&&t.item===name));
    if(nakdi)db.tariffs.push({id:id(),year:activeYear,item:name,mode:'Nakdi',amount:Number(nakdi),years:0,source:'Kullanıcı girişi'});
    if(ayni)db.tariffs.push({id:id(),year:activeYear,item:name,mode:'Ayni',amount:Number(ayni),years:0,source:'Kullanıcı girişi'});
    await save();d.close();render();toast('Yıllık fiyat listesi güncellendi.');
  };
}
function addPrice(){return priceEditor()}
function editPrice(item){return priceEditor(item)}
function deletePrice(item){if(!confirm(`“${item}” kaleminin bu yıldaki nakdi ve ayni fiyatlarını silmek istiyor musunuz?`))return;db.tariffs=db.tariffs.filter(t=>!(Number(t.year)===Number(activeYear)&&t.item===item));save().then(()=>{render();toast('Giyecek kalemi silindi.')})}
async function copyPrices(){if(priceRows().length){toast('Bu yılın fiyat listesi zaten var.');return}const prev=[...new Set(db.tariffs.map(t=>Number(t.year)).filter(y=>y<activeYear))].sort((a,b)=>b-a)[0];if(!prev){toast('Kopyalanacak önceki yıl fiyat listesi yok.');return}for(const t of priceRows(prev))db.tariffs.push({...t,id:id(),year:activeYear,source:`${prev} yılından kopyalandı · güncelleyin`});const old=db.years.find(y=>Number(y.year)===prev)||{};db.years.push({year:activeYear,incomeTax:'',stampTax:'',source:`${prev} yılından kopyalandı · güncelleyin`});await save();render();toast(`${prev} yılı kopyalandı. Yeni genelge tutarlarını güncelleyin.`)}
function calculate(){const yr=Number(activeYear),inst=selectedInstitution;if(!inst){toast('Ödeme döneminde kurum seçin.');return}if(!priceRows(yr).length){toast('Önce seçilen yılın Yıllık Fiyat Listesini doldurun.');return}const people=db.staff.filter(s=>s.institutionId===inst&&s.active!==false),due=[];for(const s of people){const selection=window.paymentSelection?.[s.id];if(!selection?.selected)continue;for(const [item,pick] of Object.entries(selection.items||{})){if(!pick.checked)continue;const t=priceFor(item,pick.mode,yr),qty=Math.max(1,Number(pick.quantity)||1);if(!t){toast(`${item} için ${pick.mode} fiyatı tanımlı değil.`);return}const amount=Math.round(Number(t.amount)*qty*100)/100,inc=0,stamp=0;due.push({staffId:s.id,staffName:s.name,title:s.title,serviceClass:s.serviceClass||'',item,mode:pick.mode,quantity:qty,unitPrice:Number(t.amount),amount,years:Number(t.years)||0,year:yr,incomeTax:inc,stampTax:stamp,net:Math.round((amount-inc-stamp)*100)/100})}}if(!due.length){toast('En az bir personel ve giyecek kalemi seçin.');return}window.pendingBatch={yr,inst,due};const cash=due.filter(x=>x.mode==='Nakdi'),ayni=due.filter(x=>x.mode==='Ayni'),sum=arr=>arr.reduce((z,x)=>z+x.amount,0),net=cash.reduce((z,x)=>z+x.net,0);$('#calcResult').innerHTML=`<div class="card"><div class="cardhead"><div><h2>Seçim özeti · ${esc(instName(inst))}</h2><p>${new Set(due.map(x=>x.staffId)).size} personel · ${due.length} giyecek kalemi · ${yr}</p></div><button class="btn" id="saveBatch">Harcama talimatını doldur ve PDF oluştur</button></div><div class="stats"><div class="stat"><div class="label">NAKDİ TOPLAM</div><strong>${money(sum(cash))}</strong><em>Ödenecek nakdi tutar ${money(net)}</em></div><div class="stat"><div class="label">AYNİ TOPLAM DEĞERİ</div><strong>${money(sum(ayni))}</strong><em>${ayni.length} kalem</em></div><div class="stat"><div class="label">ALAN PERSONEL</div><strong>${new Set(due.map(x=>x.staffId)).size}</strong><em>Seçilen kurum personeli</em></div></div><div class="tablewrap"><table><thead><tr><th>Personel</th><th>Unvan</th><th>Giyecek</th><th>Tür</th><th>Miktar</th><th>Toplam</th></tr></thead><tbody>${due.map(x=>`<tr><td>${esc(x.staffName)}</td><td>${esc(x.title)}</td><td>${esc(x.item)}</td><td>${esc(x.mode)}</td><td>${x.quantity}</td><td class="money">${money(x.amount)}</td></tr>`).join('')}</tbody></table></div></div>`;$('#saveBatch').onclick=saveBatch}
// [temizlendi] eski saveBatch() tanimi
// [temizlendi] eski viewBatch() tanimi
async function init(){nav();await load();window.paymentSelection={};await seedPrice2026();window.pdfSaved=paths=>toast(`Harcama Talimatı ve Dağıtım Listesi PDF'leri kaydedildi.`);window.pdfFailed=message=>toast(`PDF oluşturulamadı: ${message}`);window.pdfTariffsLoaded=showPdfPricePreview;window.pdfImportFailed=message=>toast(`PDF içe aktarılamadı: ${message}`);render()}
init();

// Resmî evrak şablonu: gönderilen Excel sayfalarındaki tam harcama talimatı ve dağıtım dökümü.
async function saveBatch(){const p=window.pendingBatch;if(!p?.due?.length){toast('Kaydedilecek ödeme kalemi yok.');return}if(db.batches.some(b=>Number(b.year)===p.yr&&b.institutionId===p.inst)){toast('Bu kurum ve yıl için kayıtlı liste zaten var.');return}const modes=new Set(p.due.map(x=>x.mode)),method=modes.size>1?'Karışık':(modes.has('Ayni')?'Ayni':'Nakdi'),amount=p.due.reduce((a,x)=>a+Number(x.amount||0),0),source=(db.years.find(x=>Number(x.year)===p.yr)||{}).source||`Hazine ve Maliye Bakanlığı ${p.yr} yılı Giyecek Yardımı Genelgesi`,cfg=db.documentSettings||{};const d=modal('Harcama talimatı bilgileri','Gönderdiğiniz Excel şablonundaki bütün alanları tamamlayın. Boş bırakılan imza ve açıklama alanları PDF’de boş görünür.',`<div class="formgrid">${field('Sayı / talimat numarası','number','')}${field('Tarih','date','','date',new Date().toISOString().slice(0,10))}${field('Harcama talebinde bulunan birim','unit','', 'text',instName(p.inst))}${field('Gerekçesi ve hukuki dayanağı','basis','', 'text',cfg.basis||source)}${field('Konusu / nev’i / niteliği','subject','', 'text',`${p.yr} yılı giyecek yardımı ödemesi`)}${field('Miktarı','quantity','', 'text',`${new Set(p.due.map(x=>x.staffId)).size} kişi`)}${field('Gerçekleştirme süresi','period','', 'text',String(p.yr))}<div class="field"><label>Gerçekleştirme usulü</label><select name="method"><option ${method==='Nakdi'?'selected':''}>Nakdi</option><option ${method==='Ayni'?'selected':''}>Ayni</option><option ${method==='Karışık'?'selected':''}>Karışık</option></select></div>${field('Tutarı veya belirlenmiş yaklaşık bedeli (TL)','amount','', 'number',amount.toFixed(2))}${field('Kullanılabilir ödenek tutarı (TL)','appropriation','', 'number',amount.toFixed(2))}${field('Ödeneğin bütçe tertibi','budget','')}${field('Gerçekleştirme görevlileri','officers','Ad soyad','text',[cfg.proposedName,cfg.proposedTitle].filter(Boolean).join(' · '))}${field('Harcama yetkilisi','authority','Ad soyad','text',[cfg.authorityName,cfg.authorityTitle].filter(Boolean).join(' · '))}<div class="field wide"><label>Açıklamalar başlığı</label><input name="explanationTitle" value="Aşağıda belirtilen personele ödenecek giyim yardımı ödemesi"></div><div class="field wide"><label>Açıklama metni</label><textarea name="explanation" rows="3" placeholder="Talimatın açıklama kutusunda yer alacak metin">${esc(`${instName(p.inst)} bünyesinde görev yapan ve giyim yardımından faydalanacak personele ait harcama talimatıdır.`)}</textarea></div>${field('Teklif eden yetkilinin adı soyadı','proposedName','', 'text',cfg.proposedName||'')}${field('Teklif eden yetkilinin unvanı','proposedTitle','', 'text',cfg.proposedTitle||'')}${field('Harcama yetkilisinin adı soyadı','authorityName','', 'text',cfg.authorityName||'')}${field('Harcama yetkilisinin unvanı','authorityTitle','', 'text',cfg.authorityTitle||'')}</div><p class="hint">Talep eden birim kurum adından otomatik gelir; gerekirse düzeltebilirsiniz. Hukuki dayanak, bütçe tertibi, açıklama ve imza bilgileri kurumunuzdaki resmî kayda göre girilmelidir.</p>`);$('#modalSave').onclick=async e=>{e.preventDefault();const f=new FormData($('#modalForm')),details=p.due.map(x=>({...x,paid:true})),batch={id:id(),year:p.yr,institutionId:p.inst,date:f.get('date')||new Date().toISOString().slice(0,10),number:String(f.get('number')||''),details,totalGross:details.filter(x=>x.mode==='Nakdi').reduce((a,x)=>a+x.amount,0),totalNet:details.filter(x=>x.mode==='Nakdi').reduce((a,x)=>a+x.net,0),totalAyni:details.filter(x=>x.mode==='Ayni').reduce((a,x)=>a+x.amount,0),harcama:{unit:f.get('unit'),basis:f.get('basis'),subject:f.get('subject'),quantity:f.get('quantity'),period:f.get('period'),method:f.get('method'),amount:Number(f.get('amount'))||0,appropriation:Number(f.get('appropriation'))||0,budget:f.get('budget'),officers:f.get('officers'),authority:f.get('authority'),explanationTitle:f.get('explanationTitle'),explanation:f.get('explanation'),proposedName:f.get('proposedName'),proposedTitle:f.get('proposedTitle'),authorityName:f.get('authorityName'),authorityTitle:f.get('authorityTitle')}};db.batches.push(batch);await save();d.close();render();toast('Liste kaydedildi. Tam şablonlu PDF hazırlanıyor.');viewBatch(batch.id);setTimeout(()=>window.chrome?.webview?.postMessage({type:'exportPdf',year:batch.year,institution:instName(batch.institutionId)}),500)}}
function viewBatch(key){
  const b=db.batches.find(x=>x.id===key);if(!b)return;
  const cfg=db.documentSettings||{};
  const h=b.harcama||{};
  const inst=instName(b.institutionId);
  const unit=districtUnit();
  const autoExplanation=`${inst} bünyesinde görev yapan ve giyim yardımından faydalanacak personele ait harcama talimatıdır.`;
  const explanation=(h.explanation&&String(h.explanation).trim())||autoExplanation;
  const proposedName=h.proposedName||cfg.proposedName||'';
  const proposedTitle=h.proposedTitle||cfg.proposedTitle||'';
  const authorityName=h.authorityName||cfg.authorityName||'';
  const authorityTitle=h.authorityTitle||cfg.authorityTitle||'';
  const editorName=h.editorName||cfg.editorName||'';
  const editorTitle=h.editorTitle||cfg.editorTitle||'';

  const people=new Map();
  for(const x of b.details){
    const r=people.get(x.staffId)||{name:x.staffName,title:x.title,nationalId:db.staff.find(s=>s.id===x.staffId)?.nationalId||'',details:[],total:0};
    r.details.push(x);r.total+=Number(x.amount)||0;people.set(x.staffId,r);
  }
  const moneyTotal=b.details.reduce((a,x)=>a+Number(x.amount||0),0);
  const cashTotal=b.details.filter(x=>x.mode!=='Ayni').reduce((a,x)=>a+Number(x.amount||0),0);
  const ayniTotal=b.details.filter(x=>x.mode==='Ayni').reduce((a,x)=>a+Number(x.amount||0),0);

  const talimatRows=[
    ['Gerekçesi ve hukuki dayanağı',h.basis],
    ['Konusu / nev’i / niteliği',h.subject],
    ['Miktarı',h.quantity],
    ['Gerçekleştirme süresi',h.period],
    ['Gerçekleştirme usulü',h.method],
    ['Tutarı veya belirlenmiş yaklaşık bedeli',money(h.amount)],
    ['Kullanılabilir ödenek tutarı',money(h.appropriation)],
    ['Ödeneğin bütçe tertibi',h.budget],
    ['Gerçekleştirme görevlileri',h.officers],
    ['Harcama Yetkilisi',h.authority]
  ];

  const peopleRows=[...people.values()].map((p,i)=>{
    const span=Math.max(1,p.details.length);
    const head=`<td rowspan="${span}">${i+1}</td><td rowspan="${span}"><b>${esc(p.name)}</b></td><td rowspan="${span}">${esc(p.title||'')}</td><td rowspan="${span}" class="mono">${esc(p.nationalId||'')}</td>`;
    return p.details.map((z,j)=>`<tr>${j===0?head:''}<td>${esc(z.item)}${z.mode==='Ayni'?' (AYNİ)':''}</td><td class="money">${money(z.amount)}</td><td>${Number(z.quantity)||1}</td></tr>`).join('');
  }).join('');

  const sign=name=>`<p><span class="lbl">İmzası :</span><span class="val"></span></p><p><span class="lbl">Adı Soyadı :</span><span class="val">${esc(name.n||'')}</span></p><p><span class="lbl">Unvanı :</span><span class="val">${esc(name.t||'')}</span></p>`;

  const body=`<div class="actions no-print"><button class="btn secondary" id="exportCash" type="button">Nakdi CSV indir</button><button class="btn secondary" id="exportAyni" type="button">Ayni CSV indir</button><button class="btn light" id="printReport" type="button">Harcama talimatı + listeyi PDF olarak kaydet</button></div><div id="printArea">

<section class="printPage instructionPage">
  <h2>HARCAMA TALİMATI</h2>
  <div class="instructionFrame">
    <div class="instructionTop"><b>Sayı: 1</b><span><b>Tarih:</b> ${dateText(b.date)}</span></div>
    <div class="requestUnit"><b>Harcama Talebinde Bulunan Birim:</b><span>${esc(unit)}</span></div>
    <div class="reasonTable">
      <div class="verticalLabel">Y A P I L A C A K&nbsp;&nbsp; H A R C A M A N I N</div>
      <table class="reporttable"><tbody>${talimatRows.map(x=>`<tr><th>${esc(x[0])}</th><td>${esc(x[1]||'')}</td></tr>`).join('')}</tbody></table>
    </div>
    <div class="explanation"><b>AÇIKLAMALAR:</b><div class="explanationBox">${esc(explanation)}</div></div>
    <div class="approval">Yukarıda belirtilen harcamanın yaptırılması hususunu olurlarınıza arz ederim.
      <div class="approvalGrid">
        <div><div class="signHead">Teklif Eden Yetkilinin</div>${sign({n:proposedName,t:proposedTitle})}</div>
        <div><div class="signHead">O L U R</div>${sign({n:authorityName,t:authorityTitle})}</div>
      </div>
    </div>
  </div>
</section>

<section class="printPage distributionPage">
  <div class="distributionDate">Tarih: ${dateText(b.date)}</div>
  <h2>${esc(inst.toLocaleUpperCase('tr'))} ${b.year} GİYİM YARDIMI ÖDEMESİ</h2>
  <table class="reporttable peopleTable">
    <thead><tr><th>Sıra No</th><th>Adı Soyadı</th><th>Unvanı</th><th>T.C.</th><th>Yardım Adı</th><th>Tutarı</th><th>Adedi</th></tr></thead>
    <tbody>${peopleRows}</tbody>
  </table>
  <div class="distributionTotal">
    <span>Kişi sayısı: <b>${people.size}</b></span>
    <span>Kalem sayısı: <b>${b.details.length}</b></span>
    <span>Nakdi: <b>${money(cashTotal)}</b></span>
    <span>Ayni: <b>${money(ayniTotal)}</b></span>
    <span class="grand">GENEL TOPLAM: <b>${money(moneyTotal)}</b></span>
  </div>
  <div class="distributionSignatures">
    <div><b>Düzenleyen</b><span>${esc(editorName)}</span><span>${esc(editorTitle)}</span></div>
    <div><b>Kontrol Eden</b><span>${esc(proposedName)}</span><span>${esc(proposedTitle)}</span></div>
    <div><b>Onaylayan</b><span>${esc(authorityName)}</span><span>${esc(authorityTitle)}</span></div>
  </div>
</section>

</div><div class="callout no-print">İki sayfa tek PDF olarak Masaüstü \\ Giyim Yardımı Çıktıları klasörüne kaydedilir.</div>`;

  modal(`Ödeme listesi · ${b.year}`,`${inst} · ${dateText(b.date)}`,body,'Kapat');
  $('#exportCash').onclick=()=>downloadCsv(b,'Nakdi');
  $('#exportAyni').onclick=()=>downloadCsv(b,'Ayni');
  $('#printReport').onclick=()=>window.chrome?.webview?.postMessage({type:'exportPdf',year:b.year,institution:inst});
}

pages.signers='İmza ve Talimat Ayarları';
function signaturesPage(){
  const c=db.documentSettings||{};
  return `<div class="card">
    <div class="cardhead"><div><h2>İmza ve harcama talimatı varsayılanları</h2><p>Buraya kaydettiğiniz bilgiler yeni harcama talimatlarına ve dağıtım listelerine otomatik aktarılır.</p></div></div>
    <div class="formgrid">
      <div class="field"><label>Düzenleyen · Adı soyadı</label><input id="cfgEditorName" value="${esc(c.editorName||'')}" placeholder="Adı Soyadı"></div>
      <div class="field"><label>Düzenleyen · Unvanı</label><input id="cfgEditorTitle" value="${esc(c.editorTitle||'')}" placeholder="Görev unvanı"></div>
      <div class="field"><label>Gerçekleştirme görevlisi (kontrol eden) · Adı soyadı</label><input id="cfgProposedName" value="${esc(c.proposedName||'')}" placeholder="Adı Soyadı"></div>
      <div class="field"><label>Gerçekleştirme görevlisi (kontrol eden) · Unvanı</label><input id="cfgProposedTitle" value="${esc(c.proposedTitle||'')}" placeholder="Görev unvanı"></div>
      <div class="field"><label>Harcama yetkilisi (onaylayan) · Adı soyadı</label><input id="cfgAuthorityName" value="${esc(c.authorityName||'')}" placeholder="Adı Soyadı"></div>
      <div class="field"><label>Harcama yetkilisi (onaylayan) · Unvanı</label><input id="cfgAuthorityTitle" value="${esc(c.authorityTitle||'')}" placeholder="Görev unvanı"></div>
      <div class="field wide"><label>Gerekçesi ve hukuki dayanağı</label><textarea id="cfgBasis" rows="4" placeholder="Harcama Talimatı sayfasındaki ilgili hücreye aktarılacak varsayılan metin">${esc(c.basis||'')}</textarea></div>
    </div>
    <button class="btn" id="saveDocSettings" type="button">İmza ve talimat bilgilerini kaydet</button>
  </div>
  <div class="callout green"><b>Dağıtım listesindeki imzalar:</b> Düzenleyen → buradaki düzenleyen, Kontrol Eden → gerçekleştirme görevlisi, Onaylayan → harcama yetkilisi. Harcama talimatında gerçekleştirme görevlisi “Teklif Eden Yetkilinin”, harcama yetkilisi “OLUR” bölümüne yazılır.</div>`;
}
async function saveDocSettings(){
  db.documentSettings={
    editorName:$('#cfgEditorName').value.trim(),
    editorTitle:$('#cfgEditorTitle').value.trim(),
    proposedName:$('#cfgProposedName').value.trim(),
    proposedTitle:$('#cfgProposedTitle').value.trim(),
    authorityName:$('#cfgAuthorityName').value.trim(),
    authorityTitle:$('#cfgAuthorityTitle').value.trim(),
    basis:$('#cfgBasis').value.trim()
  };
  await save();
  toast('İmza ve talimat varsayılanları kaydedildi.');
}
function render(){const root=$('#page');if(page==='overview')root.innerHTML=overview();if(page==='institutions')root.innerHTML=institutionsPage();if(page==='staff')root.innerHTML=staffPage();if(page==='signers')root.innerHTML=signaturesPage();if(page==='tariffs')root.innerHTML=yearCatalogPage();if(page==='payments')root.innerHTML=manualPaymentsPage();if(page==='payments')drawRoster();bindPage();const saveCfg=$('#saveDocSettings');if(saveCfg)saveCfg.onclick=saveDocSettings;const tariffFiles=$('#tariffPdfFiles');if(tariffFiles)tariffFiles.onchange=()=>importTariffPdfFiles(tariffFiles.files)}async function loadPdfJs(){if(window.pdfjsLib)return window.pdfjsLib;await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';script.onload=resolve;script.onerror=()=>reject(new Error('PDF okuma bileşeni yüklenemedi. PDF içe aktarma için internet bağlantısı gerekir.'));document.head.appendChild(script)});if(!window.pdfjsLib)throw new Error('PDF okuma bileşeni başlatılamadı.');window.pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';return window.pdfjsLib}
function extractPriceRows(textContent){const lines=new Map();for(const item of textContent.items||[]){const value=String(item.str||'').trim();if(!value)continue;const y=Math.round(Number(item.transform?.[5]||0)*2)/2;const line=lines.get(y)||[];line.push({x:Number(item.transform?.[4]||0),value});lines.set(y,line)}const rows=[];for(const [,parts] of [...lines.entries()].sort((a,b)=>b[0]-a[0])){const line=parts.sort((a,b)=>a.x-b.x).map(x=>x.value).join(' ').replace(/\\s+/g,' ').trim();const match=line.match(/(?:^|\\s)(\\d{1,2})\\s+(.+?)\\s+([\\d.]+,\\d{2})\\s*$/);if(!match)continue;const rowNumber=Number(match[1]),amount=Number(match[3].replace(/\\./g,'').replace(',','.'));if(rowNumber>=1&&rowNumber<=100&&Number.isFinite(amount)&&amount>0)rows.push({rowNumber,amount,rawItem:match[2].trim()})}const byNumber=new Map();for(const row of rows){if(byNumber.has(row.rowNumber))throw new Error('PDF içinde yinelenen sıra numarası bulundu: '+row.rowNumber);byNumber.set(row.rowNumber,row)}return [...byNumber.values()].sort((a,b)=>a.rowNumber-b.rowNumber)}
async function importTariffPdfFiles(fileList){const button=$('[data-action="import-tariff-pdf"]'),input=$('#tariffPdfFiles');if(button)button.disabled=true;try{const files=[...(fileList||[])];if(!files.length)return;const pdfjs=await loadPdfJs(),sheets=[];for(const file of files){if(file.type!=='application/pdf'&&!file.name.toLowerCase().endsWith('.pdf'))throw new Error(file.name+' geçerli bir PDF dosyası değil.');const bytes=await file.arrayBuffer();if(bytes.byteLength<500)throw new Error(file.name+' dosyası boş veya geçersiz görünüyor.');const pdf=await pdfjs.getDocument({data:new Uint8Array(bytes)}).promise;for(let pageNo=1;pageNo<=pdf.numPages;pageNo++){const page=await pdf.getPage(pageNo),content=await page.getTextContent(),text=(content.items||[]).map(x=>x.str||'').join(' '),yearMatch=text.match(/\\b(20\\d{2})\\b/);if(!yearMatch)throw new Error(file.name+' · '+pageNo+'. sayfada fiyat yılı bulunamadı.');const year=Number(yearMatch[1]),normalized=text.toLocaleLowerCase('tr').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').replace(/ı/g,'i');let mode='';if(/ayni/.test(normalized))mode='Ayni';if(/nakdi/.test(normalized)){if(mode)throw new Error(file.name+' · '+pageNo+'. sayfada ayni/nakdi türü belirsiz.');mode='Nakdi'}if(!mode)continue;const rows=extractPriceRows(content);if(rows.length<30||rows.some((r,i)=>r.rowNumber!==i+1))throw new Error(file.name+' · '+pageNo+'. sayfada fiyat satırları eksik veya sıra numaraları hatalı ('+rows.length+' satır).');sheets.push({year,mode,fileName:file.name+' · Sayfa '+pageNo,rows:rows.map(r=>({rowNumber:r.rowNumber,item:r.rawItem,amount:r.amount})),warnings:[]})}}if(!sheets.length)throw new Error('Seçilen PDF sayfalarında yılı ve Ayni/Nakdi türü belirlenebilen fiyat tablosu bulunamadı.');const keys=new Set();for(const sh of sheets){const key=sh.year+'-'+sh.mode;if(keys.has(key))throw new Error(sh.year+' yılı '+sh.mode+' listesi birden fazla sayfada bulundu. Tekrar eden sayfaları ayrı PDF olarak seçmeyin.');keys.add(key)}showPdfPricePreview({sheets,errors:[]})}catch(error){modal('PDF içe aktarılamadı',String(error?.message||error),'<div class="callout">Kontroller tamamlanamadığı için hiçbir fiyat kaydedilmedi. Mevcut fiyat listeniz korunmuştur.</div>','Kapat')}finally{if(button)button.disabled=false;if(input)input.value=''}}
function showPdfPricePreview(result){const sheets=result?.sheets||[],errors=[...(result?.errors||[])],years=new Set(sheets.map(x=>Number(x.year)));if(!sheets.length){modal('PDF okunamadı',errors.join(' · ')||'PDF içinde fiyat listesi bulunamadı.','<div class="callout">Bakanlığın metin içeren Ek-1 veya Ek-2 fiyat listesi PDF dosyasını seçin. Taranmış/görüntü PDF dosyaları otomatik okunamıyor.</div>','Kapat');return}if(years.size!==1)errors.push('Seçilen PDF’lerde tek bir fiyat yılı bulunmalıdır.');const allRows=sheets.flatMap(x=>x.rows||[]);for(const sh of sheets){if((sh.rows||[]).length<30)errors.push(`${sh.fileName} · ${sh.mode}: yalnızca ${(sh.rows||[]).length} satır okundu; eksik tablo kaydedilmeyecek.`);if(sh.warnings?.length)errors.push(`${sh.fileName}: ${sh.warnings.join(' ')}`);const seen=new Set();for(const row of sh.rows||[]){const key=String(row.item||'').trim().toLocaleLowerCase('tr');if(seen.has(key))errors.push(`${sh.mode} listesinde yinelenen giyecek adı: ${row.item}`);seen.add(key);if(!key||!Number.isFinite(Number(row.amount))||Number(row.amount)<=0)errors.push(`${sh.mode} listesinde geçersiz satır var.`)}}if(!['Ayni','Nakdi'].includes(sheets[0].mode)||sheets.some(x=>!['Ayni','Nakdi'].includes(x.mode)))errors.push('PDF türü Ayni veya Nakdi olarak belirlenemedi.');const uniqueErrors=[...new Set(errors)],year=years.values().next().value;const body=`<div class="callout green">PDF’deki liste otomatik okundu. Her dosya için yılı, yardım türünü, satır sayısını ve tutarları gözden geçirin. Seçmediğiniz yardım türünün fiyatları değiştirilmez.</div>${uniqueErrors.length?`<div class="callout">${uniqueErrors.map(esc).join('<br>')}</div>`:''}<div class="pdfImportSheets">${sheets.map(sh=>`<div class="card"><div class="cardhead"><div><h3>${esc(sh.year)} · ${esc(sh.mode==='Ayni'?'Ayni':'Nakdi')} birim fiyatlar</h3><p>${esc(sh.fileName)} · ${sh.rows.length} satır</p></div></div><div class="tablewrap"><table><thead><tr><th>Sıra</th><th>Giyecek kalemi</th><th>Birim fiyat</th></tr></thead><tbody>${sh.rows.map(r=>`<tr><td>${r.rowNumber}</td><td>${esc(r.item)}</td><td class="money">${money(r.amount)}</td></tr>`).join('')}</tbody></table></div></div>`).join('')}</div><p class="hint">PDF’de metin katmanı varsa aktarım yapılır. Hatalı/eksik okuma tespitinde kaydetme kapatılır. Resmî ödeme öncesi önizleme değerlerini kontrol edin.</p>`;const d=modal('Bakanlık fiyat listesi · Önizleme',`${sheets.length} liste bulundu · ${allRows.length} fiyat satırı`,body,'Fiyatları içe aktar');const saveButton=$('#modalSave');saveButton.disabled=uniqueErrors.length>0;saveButton.title=uniqueErrors.length?'Hatalı/eksik liste düzeltilmeden içe aktarılamaz.':'';saveButton.onclick=async e=>{e.preventDefault();if(uniqueErrors.length)return;const modes=new Set(sheets.map(x=>x.mode)),year=Number(sheets[0].year);if(db.tariffs.some(t=>Number(t.year)===year&&modes.has(t.mode))&&!confirm(`${year} yılının seçilen yardım türlerindeki mevcut fiyatları PDF’den okunanlarla değiştirilsin mi?`))return;db.tariffs=db.tariffs.filter(t=>!(Number(t.year)===year&&modes.has(t.mode)));for(const sh of sheets)for(const row of sh.rows)db.tariffs.push({id:id(),year,item:row.item,mode:sh.mode,amount:Number(row.amount),years:0,source:`${sh.fileName} · Bakanlık PDF içe aktarma`});let y=db.years.find(x=>Number(x.year)===year);if(!y){y={year,incomeTax:'',stampTax:''};db.years.push(y)}y.source=sheets.map(x=>x.fileName).join(' + ');activeYear=year;await save();d.close();render();toast(`${allRows.length} fiyat satırı ${year} yılına aktarıldı.`)}}

function openBackups(){window.chrome?.webview?.postMessage({type:'openBackupFolder'})}
// ---- Kurum / personel düzenleme (v1.3.0) ----
// [tasindi] bu fonksiyon ilgili sayfa blogunda yeniden tanimlandi

function editStaff(key){
  const s=db.staff.find(x=>x.id===key);if(!s)return;
  const instOptions=db.institutions.map(i=>`<option value="${esc(i.id)}" ${i.id===s.institutionId?'selected':''}>${esc(i.name)}</option>`).join('');
  const classOptions=[...new Set([...classes,s.serviceClass].filter(Boolean))].map(c=>`<option ${c===s.serviceClass?'selected':''}>${esc(c)}</option>`).join('');
  const d=modal('Personeli düzenle','Personel bilgilerini güncelleyin.',`<div class="formgrid">${field('Ad soyad','name','Ad Soyad','text',s.name)}<div class="field"><label>Kurum</label><select name="institutionId" required>${instOptions}</select></div>${field('Kadro unvanı','title','Örn. Hizmetli','text',s.title)}<div class="field"><label>Hizmet sınıfı</label><select name="serviceClass">${classOptions}</select></div>${field('T.C. kimlik numarası (isteğe bağlı)','nationalId','11 haneli numara','text',s.nationalId||'')}<div class="field"><label>Durum</label><select name="active"><option value="true" ${s.active!==false?'selected':''}>Aktif</option><option value="false" ${s.active===false?'selected':''}>Pasif</option></select></div></div>`);
  $('#modalSave').onclick=async e=>{e.preventDefault();const f=new FormData($('#modalForm')),tc=String(f.get('nationalId')||'').trim(),name=String(f.get('name')||'').trim(),title=String(f.get('title')||'').trim();if(!name||!title){toast('Ad soyad ve unvan zorunlu.');return}if(tc&&!/^\d{11}$/.test(tc)){toast('T.C. kimlik numarası 11 rakam olmalıdır.');return}s.name=name;s.institutionId=f.get('institutionId');s.title=title;s.serviceClass=f.get('serviceClass');s.nationalId=tc;s.active=f.get('active')==='true';await save();d.close();render();toast('Personel güncellendi.')};
}
// ---- Kayıtlı ödeme listesini güncelleme / silme (v1.3.0) ----
function editBatch(key){
  const b=db.batches.find(x=>x.id===key);if(!b)return;
  const h=b.harcama||{},cfg=db.documentSettings||{};
  const fi=(label,name,type,value)=>`<div class="field"><label>${label}</label><input name="${name}" type="${type||'text'}" value="${esc(value||'')}"></div>`;
  const d=modal('Harcama talimatı bilgilerini güncelle',`${instName(b.institutionId)} · ${b.year} · ${dateText(b.date)}`,
    `<div class="formgrid">
      ${fi('Sayı / talimat numarası','number','text',b.number)}${fi('Tarih','date','date',b.date)}
      ${fi('Harcama talebinde bulunan birim','unit','text',h.unit||instName(b.institutionId))}${fi('Gerekçesi ve hukuki dayanağı','basis','text',h.basis)}
      ${fi('Konusu / nev’i / niteliği','subject','text',h.subject)}${fi('Miktarı','quantity','text',h.quantity)}
      ${fi('Gerçekleştirme süresi','period','text',h.period)}<div class="field"><label>Gerçekleştirme usulü</label><select name="method">${['Nakdi','Ayni','Karışık'].map(m=>`<option ${h.method===m?'selected':''}>${m}</option>`).join('')}</select></div>
      ${fi('Tutarı veya yaklaşık bedeli (TL)','amount','number',h.amount)}${fi('Kullanılabilir ödenek (TL)','appropriation','number',h.appropriation)}
      ${fi('Ödeneğin bütçe tertibi','budget','text',h.budget)}${fi('Gerçekleştirme görevlileri','officers','text',h.officers)}
      ${fi('Harcama yetkilisi','authority','text',h.authority)}
      <div class="field wide"><label>Açıklamalar başlığı</label><input name="explanationTitle" value="${esc(h.explanationTitle||'')}"></div>
      <div class="field wide"><label>Açıklama metni</label><textarea name="explanation" rows="3">${esc(h.explanation||'')}</textarea></div>
      ${fi('Düzenleyen adı soyadı','editorName','text',h.editorName||cfg.editorName||'')}${fi('Düzenleyen unvanı','editorTitle','text',h.editorTitle||cfg.editorTitle||'')}
      ${fi('Teklif eden yetkilinin adı soyadı','proposedName','text',h.proposedName||cfg.proposedName||'')}${fi('Teklif eden yetkilinin unvanı','proposedTitle','text',h.proposedTitle||cfg.proposedTitle||'')}
      ${fi('Harcama yetkilisinin adı soyadı','authorityName','text',h.authorityName||cfg.authorityName||'')}${fi('Harcama yetkilisinin unvanı','authorityTitle','text',h.authorityTitle||cfg.authorityTitle||'')}
    </div><p class="hint">Açıklama metnini boş bırakırsanız kurum adına göre otomatik metin yazılır.</p>`);
  $('#modalSave').onclick=async e=>{
    e.preventDefault();
    const f=new FormData($('#modalForm'));
    b.number=String(f.get('number')||'');
    b.date=String(f.get('date')||b.date);
    b.harcama={...(b.harcama||{}),
      unit:f.get('unit'),basis:f.get('basis'),subject:f.get('subject'),quantity:f.get('quantity'),
      period:f.get('period'),method:f.get('method'),amount:Number(f.get('amount'))||0,
      appropriation:Number(f.get('appropriation'))||0,budget:f.get('budget'),officers:f.get('officers'),
      authority:f.get('authority'),explanationTitle:f.get('explanationTitle'),explanation:f.get('explanation'),
      editorName:f.get('editorName'),editorTitle:f.get('editorTitle'),
      proposedName:f.get('proposedName'),proposedTitle:f.get('proposedTitle'),
      authorityName:f.get('authorityName'),authorityTitle:f.get('authorityTitle')};
    await save();d.close();render();toast('Ödeme listesi güncellendi.');
  };
}

function deleteBatch(key){
  const b=db.batches.find(x=>x.id===key);if(!b)return;
  if(!confirm(`${b.year} · ${instName(b.institutionId)} ödeme listesi silinecek. Bu işlem geri alınamaz. Devam edilsin mi?`))return;
  db.batches=db.batches.filter(x=>x.id!==key);
  save().then(()=>{render();toast('Ödeme listesi silindi.')});
}