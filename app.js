'use strict';
const $ = id => document.getElementById(id);
const sessions = [];
let current, signal, chartMode = 'zoom', loading = false;
const labels = {
  edaRaw:['EDA · surovi signal','Izvorna vrednost'],
  edaFiltered:['EDA · filtrirani signal','Izvorna vrednost'],
  ppgRaw:['PPG · surovi signal','Izvorna vrednost'],
  ppgFiltered:['PPG · filtrirani signal','Izvorna vrednost'],
  hrPpg:['Srčni utrip','Udarci/min'],
  temperatureRaw:['Temperatura','Izvorna vrednost'],
  hrvPpg:['Variabilnost utripa (HRV)','Izvorna vrednost'],
  ppgPeaks:['PPG · vrhovi','Oznaka vrha'],
  edaPeaksAndValleys:['EDA · vrhovi in doline','Oznaka'],
  hrPpgPeaksAndValleys:['Utrip · vrhovi in doline','Oznaka'],
  hrPpgPeakAndValleyHeartRate:['Utrip ob vrhovih','Izvorna vrednost'],
  ringBattery:['Baterija prstana','Izvorna vrednost'],
  ringRSSI:['Moč povezave','Izvorna vrednost'],
  appBattery:['Baterija naprave','Izvorna vrednost'],
  appChargeState:['Stanje polnjenja','Izvorna vrednost']
};
const title = code => labels[code]?.[0] || code;
const colors = ['#167f72','#db864d','#6e72bf','#cf637f','#86a742','#4995c2'];
function csvRows(text) {
  const rows = []; let row = [], cell = '', quoted = false;
  for (let i=0;i<text.length;i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i+1] === '"') {cell += '"'; i++;}
      else quoted = !quoted;
    } else if (char === ',' && !quoted) {row.push(cell); cell='';}
    else if ((char === '\n' || char === '\r') && !quoted) {
      row.push(cell);
      if (row.some(value => value.trim())) rows.push(row);
      row=[]; cell='';
      if (char === '\r' && text[i+1] === '\n') i++;
    } else cell += char;
  }
  row.push(cell);
  if (row.some(value => value.trim())) rows.push(row);
  if (quoted) throw Error('Nezaključen narekovaj v tabeli CSV.');
  return rows;
}
async function readSession(file) {
  if (!window.JSZip || !window.Plotly) throw Error('Knjižnice se niso naložile. Preveri internetno povezavo in osveži stran.');
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  if (!zip.file('session.json')) throw Error('Datoteka nima podatkov session.json. Izberi izvirni posnetek .senstream.');
  const meta = JSON.parse(await zip.file('session.json').async('string'));
  const result = {name:file.name, meta, channels:[], markers:[], warnings:[], enabled:new Set()};
  const entries = Object.values(zip.files).filter(entry => !entry.dir && entry.name.startsWith('signalFiles/') && entry.name.endsWith('.csv'));
  for (const entry of entries) {
    const parts = entry.name.split('/');
    const device = parts[parts.length-2], code = parts.at(-1).slice(0,-4);
    const rows = csvRows((await entry.async('string')).replace(/^\uFEFF/,''));
    if (code === 'eventMarkers') {
      rows.forEach((row,index) => {
        const time = row[0].trim() ? Number(row[0])/1e6 : NaN;
        if (Number.isFinite(time)) result.markers.push({time,label:row.slice(1).join(', ') || 'Dogodek'});
        else result.warnings.push('Marker, vrstica '+(index+1)+': '+row.join(', '));
      });
    } else if (rows.length) {
      const x=[], y=[]; let invalid=0;
      rows.forEach(row => {
        const time = row[0]?.trim() ? Number(row[0])/1e6 : NaN;
        const value = row[1]?.trim() ? Number(row[1]) : NaN;
        if (row.length===2 && Number.isFinite(time) && Number.isFinite(value)) {x.push(time); y.push(value);}
        else invalid++;
      });
      if (invalid) result.warnings.push(device+' / '+code+': '+invalid+' neveljavnih vrstic ni prikazanih.');
      if (x.length) {result.channels.push({device,code,x,y}); result.enabled.add(device);}
    }
    await new Promise(resolve => setTimeout(resolve,0));
  }
  if (!result.channels.length) throw Error('Posnetek ne vsebuje podprtih številskih meritev.');
  result.markers.sort((a,b)=>a.time-b.time);
  result.duration = result.channels.reduce((max,c)=>Math.max(max,...[c.x[0],c.x.at(-1)]),0);
  return result;
}
function element(tag,text,className) {
  const node=document.createElement(tag);
  if (text!==undefined) node.textContent=text;
  if (className) node.className=className;
  return node;
}
async function loadFiles(files) {
  if (loading || !files.length) return;
  loading=true; $('error').hidden=true;
  $('files').disabled=true; $('add').disabled=true;
  let last;
  const errors=[];
  for (const file of files) {
    $('status').textContent='Odpiram '+file.name+' …';
    try {
      const session=await readSession(file);
      sessions.push(session); last=sessions.length-1;
      $('sessions').append(new Option(file.name,String(last)));
    } catch(error) {errors.push(file.name+' — '+error.message);}
  }
  if (last!==undefined) { $('sessions').value=String(last); selectSession(last); }
  if (errors.length) {$('error').textContent=errors.join('\n'); $('error').hidden=false;}
  $('status').textContent=''; $('files').value='';
  $('files').disabled=false; $('add').disabled=false; loading=false;
}
function selectSession(index) {
  current=sessions[index];
  $('welcome').hidden=true; $('workspace').hidden=false;
  $('metadata').replaceChildren();
  const date=new Date(current.meta.start);
  const details=[
    Number.isNaN(date.getTime()) ? 'Datum ni zapisan' : date.toLocaleString('sl-SI'),
    current.duration.toFixed(1)+' s',
    current.enabled.size+' naprav v posnetku',
    current.channels.reduce((sum,c)=>sum+c.x.length,0).toLocaleString('sl-SI')+' meritev'
  ];
  details.forEach(text=>$('metadata').append(element('span',text)));
  $('signals').replaceChildren();
  const codes=[...new Set(current.channels.map(c=>c.code))];
  codes.sort((a,b)=>Object.keys(labels).indexOf(a)-Object.keys(labels).indexOf(b));
  codes.forEach(code=>{
    const button=element('button',title(code)); button.dataset.code=code;
    button.onclick=()=>selectSignal(code);
    $('signals').append(button);
  });
  $('devices').replaceChildren();
  [...new Set(current.channels.map(c=>c.device))].forEach((device,index)=>{
    const label=element('label'); const checkbox=document.createElement('input');
    checkbox.type='checkbox'; checkbox.checked=current.enabled.has(device);
    checkbox.onchange=()=>{
      if (checkbox.checked) current.enabled.add(device); else current.enabled.delete(device);
      render();
    };
    label.append(checkbox,element('span',device)); label.style.color=colors[index%colors.length];
    $('devices').append(label);
  });
  renderMarkers();
  selectSignal(codes.includes('edaRaw')?'edaRaw':codes[0]);
}
function selectSignal(code) {
  signal=code;
  document.querySelectorAll('#signals button').forEach(b=>{b.classList.toggle('active',b.dataset.code===code); b.setAttribute('aria-pressed',String(b.dataset.code===code));});
  $('charttitle').textContent=title(code); $('signalcode').textContent=code;
  render();
}
function renderMarkers() {
  $('markercount').textContent='('+current.markers.length+')';
  $('markerinfo').textContent=current.markers.length+' dogodkov';
  const panel=$('markertable'); panel.replaceChildren();
  if (!current.markers.length) panel.append(element('p','V tem posnetku ni shranjenih markerjev.','empty'));
  else {
    const table=element('table'), head=element('tr');
    ['Čas (s)','Dogodek',''].forEach(t=>head.append(element('th',t)));
    table.append(head);
    current.markers.forEach(marker=>{
      const row=element('tr'), action=element('td'), button=element('button','Pokaži na grafu');
      button.onclick=()=>{
        const half=Math.max(2,Math.min(10,current.duration/10));
        Plotly.relayout('chart',{'xaxis.range':[Math.max(0,marker.time-half),marker.time+half]});
        $('chart').scrollIntoView({behavior:'smooth',block:'center'});
      };
      action.append(button); row.append(element('td',marker.time.toFixed(3)),element('td',marker.label),action);
      table.append(row);
    });
    panel.append(table);
  }
  if (current.warnings.length) {
    const details=element('details'), summary=element('summary','Opozorila pri branju ('+current.warnings.length+')');
    details.append(summary);
    current.warnings.forEach(w=>details.append(element('p',w,'warning')));
    panel.append(details);
  }
}
function render() {
  if (!current) return;
  const channels=current.channels.filter(c=>c.code===signal && current.enabled.has(c.device));
  const devices=[...new Set(current.channels.map(c=>c.device))];
  const peaks=/Peaks|PeaksAndValleys/.test(signal);
  const traces=channels.map(c=>({
    x:c.x,y:c.y,name:c.device,type:'scattergl',mode:peaks?'markers':'lines',
    line:{color:colors[devices.indexOf(c.device)%colors.length],width:1.4},
    marker:{size:5,color:colors[devices.indexOf(c.device)%colors.length]},
    hovertemplate:'%{x:.4f} s<br>%{y:.6g}<extra>%{fullData.name}</extra>'
  }));
  const visibleMarkers=$('showmarkers').checked?current.markers:[];
  $('emptychart').hidden=!!channels.length; $('chart').hidden=!channels.length;
  $('csv').disabled=!channels.length; $('png').disabled=!channels.length;
  const shapes=visibleMarkers.map(m=>({type:'line',xref:'x',yref:'paper',x0:m.time,x1:m.time,y0:0,y1:1,line:{color:'#9a6d9b',width:1,dash:'dot'}}));
  // Marker labels are rendered as plain text in the event list to preserve their source contents.
  const layout={
    margin:{l:65,r:20,t:35,b:70},paper_bgcolor:'#fff',plot_bgcolor:'#fff',
    font:{family:'DM Sans, Arial',size:12,color:'#5f796d'},
    xaxis:{title:{text:'Čas od začetka posnetka (s)'},gridcolor:'#eef2eb',zeroline:false,rangeslider:{visible:true,thickness:.10}},
    yaxis:{title:{text:labels[signal]?.[1]||'Izvorna vrednost'},gridcolor:'#eef2eb',zeroline:false},
    legend:{orientation:'h',y:1.12,x:0},dragmode:chartMode,hovermode:'closest',shapes
  };
  Plotly.react('chart',traces,layout,{
    responsive:true,scrollZoom:true,displaylogo:false,displayModeBar:true,
    modeBarButtonsToRemove:['lasso2d','select2d'],toImageButtonOptions:{filename:'senstream-'+signal,scale:2}
  });
  $('from').value=0; $('to').value=current.duration.toFixed(3);
  $('signalnote').textContent=channels.length
    ? 'Prikazanih '+channels.reduce((n,c)=>n+c.x.length,0).toLocaleString('sl-SI')+' izvornih vzorcev. '+(signal==='hrPpg'?'Srčni utrip je prebran iz posnetka.':'Enota je označena kot izvorna vrednost, kjer je datoteka izrecno ne določa.')
    : 'Izbrana naprava tega signala nima. Izberi drugo napravo.';
}
function setMode(mode) {
  chartMode=mode;
  $('zoom').setAttribute('aria-pressed',String(mode==='zoom'));
  $('pan').setAttribute('aria-pressed',String(mode==='pan'));
  if (current) Plotly.relayout('chart',{dragmode:mode});
}
function saveCSV() {
  const channels=current.channels.filter(c=>c.code===signal&&current.enabled.has(c.device));
  const rows=['Naprava,Signal,Cas_s,Vrednost'];
  channels.forEach(c=>c.x.forEach((time,i)=>{
    // Prefix spreadsheet formula characters in source identifiers.
    const safe=value=>'"'+String(value).replace(/^[=+@-]/,"'$&").replaceAll('"','""')+'"';
    rows.push(safe(c.device)+','+safe(signal)+','+time+','+c.y[i]);
  }));
  const url=URL.createObjectURL(new Blob(['\uFEFF'+rows.join('\r\n')],{type:'text/csv;charset=utf-8'}));
  const a=element('a'); a.href=url; a.download='senstream-'+signal+'.csv'; a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
$('files').onchange=e=>loadFiles([...e.target.files]);
$('dropzone').onclick=()=>$('files').click();
$('dropzone').onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();$('files').click();}};
$('add').onclick=()=>$('files').click();
document.addEventListener('dragover',e=>{e.preventDefault();$('dropzone').classList.add('dragging');});
document.addEventListener('dragleave',()=>$('dropzone').classList.remove('dragging'));
document.addEventListener('drop',e=>{e.preventDefault();$('dropzone').classList.remove('dragging');loadFiles([...e.dataTransfer.files]);});
$('sessions').onchange=e=>selectSession(Number(e.target.value));
$('showmarkers').onchange=render;
$('zoom').onclick=()=>setMode('zoom'); $('pan').onclick=()=>setMode('pan');
$('reset').onclick=()=>{if(current)Plotly.relayout('chart',{'xaxis.autorange':true,'yaxis.autorange':true});};
$('png').onclick=()=>Plotly.downloadImage('chart',{format:'png',filename:'senstream-'+signal,width:1500,height:800,scale:2});
$('csv').onclick=saveCSV;
$('apply').onclick=()=>{
  const from=Number($('from').value), to=Number($('to').value);
  if (!$('from').value||!$('to').value||!Number.isFinite(from)||!Number.isFinite(to)||from>=to) {
    $('error').textContent='Vnesi veljaven interval. Začetek mora biti manjši od konca.';$('error').hidden=false;return;
  }
  $('error').hidden=true; Plotly.relayout('chart',{'xaxis.range':[from,to]});
};
$('markersnav').onclick=()=>$('markerpanel').scrollIntoView({behavior:'smooth'});
$('help').onclick=()=>$('instructions').showModal();
$('closehelp').onclick=()=>$('instructions').close();

