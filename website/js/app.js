const products=[
{id:"short-notes",category:"books",title:"Short Notes Book",short:"Plain white / ruled notes book",desc:"Choose the page count. No artwork or PDF upload is required.",tone:"green",icon:"bi-journal-text",visual:"book",mode:"option",options:[["50 pages",10],["100 pages",20],["150 pages",30],["200 pages",40]]},
{id:"crown-size",category:"books",title:"Crown Size",short:"Crown-size paper book",desc:"Standard crown-size product. Select only the quantity you need.",tone:"paper",icon:"bi-book",visual:"book",mode:"fixed",price:30},
{id:"regular-long",category:"books",title:"Regular Long",short:"Regular long paper book",desc:"Regular long-size paper product.",tone:"teal",icon:"bi-journal-richtext",visual:"notebook",mode:"fixed",price:50},
{id:"bar-long",category:"books",title:"Bar Long",short:"Bar long paper book",desc:"Bar long-size paper product.",tone:"orange",icon:"bi-book-half",visual:"book",mode:"fixed",price:70},
{id:"a4-paper",category:"paper",title:"A4 Paper Sets",short:"A4 copier paper \u2014 one set",desc:"One A4 paper set for future printing. No upload required.",tone:"paper",icon:"bi-file-earmark-text",visual:"print",mode:"fixed",price:230},
{id:"7kg-long",category:"paper",title:"7kg Long Set Paper",short:"Long-size paper set",desc:"Select only the number of sets you want.",tone:"green",icon:"bi-file-earmark",visual:"print",mode:"fixed",price:50},
{id:"maha-bar-long",category:"paper",title:"Maha Bar Long (8kg)",short:"8kg Maha Bar Long paper",desc:"Select only the number of sets you want.",tone:"orange",icon:"bi-stack",visual:"print",mode:"fixed",price:90},
{id:"osr",category:"record",title:"OSR Sheets",short:"OSR sheets for record sets",desc:"Select only the required quantity.",tone:"teal",icon:"bi-files",visual:"print",mode:"fixed",price:100},
{id:"thin-osr",category:"record",title:"Thin OSR Sheets",short:"Thin OSR record sheets",desc:"Thin OSR sheets for records.",tone:"green",icon:"bi-file-earmark",visual:"print",mode:"fixed",price:40},
{id:"thick-osr",category:"record",title:"Thick OSR Sheets",short:"Thick OSR record sheets",desc:"Thick OSR sheets for records.",tone:"paper",icon:"bi-file-earmark-richtext",visual:"print",mode:"fixed",price:50},
{id:"files",category:"record",title:"Files (Record)",short:"Record / document files",desc:"Paper files for organizing records.",tone:"orange",icon:"bi-folder2-open",visual:"print",mode:"fixed",price:60},
{id:"custom-books",category:"custom",title:"Customized Books",short:"PDF-based custom book printing",desc:"Upload a PDF. Each PDF page costs \u20B91 per copy.",tone:"teal",icon:"bi-file-earmark-pdf",visual:"book",mode:"pdf",perPage:1},
{id:"exam-pads",category:"custom",title:"Exam Pads",short:"White exam pad with school / college branding",desc:"Upload a logo/title image or single-page PDF.",tone:"orange",icon:"bi-card-heading",visual:"pad",mode:"uploadOption",options:[["50 sets",50],["100 sets",100],["150 sets",150],["200 sets",200]]},
{id:"rough-books",category:"books",title:"Rough Books",short:"Recyclable newsprint paper",desc:"Rough books made with newsprint/recyclable paper.",tone:"green",icon:"bi-journal-bookmark",visual:"notebook",mode:"option",options:[["50 pages",50],["100 pages",100],["150 pages",150],["200 pages",200]]}
];
const DISCOUNT_RATE=.10;
// The website and API are served from the same laptop during local testing.
// Using the current hostname makes the exact same frontend work from laptop and mobile LAN.
const IS_LOCAL_HOST = (() => {
  const host = location.hostname;
  if (host === "localhost" || host === "127.0.0.1") return true;
  const parts = host.split(".").map(Number);
  if (parts.length !== 4 || parts.some(n => !Number.isInteger(n) || n < 0 || n > 255)) return false;
  return parts[0] === 10 ||
    (parts[0] === 192 && parts[1] === 168) ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31);
})();
const API_BASE_URL = IS_LOCAL_HOST
  ? `${location.protocol}//${location.hostname}:8000`
  : location.origin;
const ACCESS_TOKEN_KEY="visionaryAccessToken";
let sessionRestoring=false;

function getAccessToken(){
  const token=localStorage.getItem(ACCESS_TOKEN_KEY);
  return token && token.trim() ? token.trim() : null;
}

function clearCustomerSession(){
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem("visionaryRefreshToken");
  localStorage.removeItem("visionaryCustomerAuthV3");
  localStorage.removeItem("visionaryCustomerLoginMethodV3");
}

function accessTokenExpired(token){
  try{
    const payload=JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));
    return !payload.exp || (Date.now()/1000)>=Number(payload.exp);
  }catch(_){ return true; }
}

function saveCustomerSession(data){
  if(data?.access_token) localStorage.setItem(ACCESS_TOKEN_KEY,data.access_token);
  if(data?.customer){
    localStorage.setItem("visionaryCustomerProfileV3",JSON.stringify(data.customer));
    localStorage.setItem("visionaryCustomerAuthV3","true");
  }
}

async function ensureCustomerSession(){
  if(sessionRestoring)return false;
  sessionRestoring=true;
  try{
    const token=getAccessToken();
    if(token && !accessTokenExpired(token))return true;
    clearCustomerSession();
    window.location.replace("../login/login.html");
    return false;
  }finally{
    sessionRestoring=false;
  }
}

async function apiFetch(path,options={},retry=true){
  const headers=new Headers(options.headers||{});
  const token=getAccessToken();
  if(token)headers.set("Authorization",`Bearer ${token}`);
  if(!(options.body instanceof FormData) && options.body && !headers.has("Content-Type")){
    headers.set("Content-Type","application/json");
  }
  let response;
  try{
    response=await fetch(`${API_BASE_URL}${path}`,{...options,headers,cache:options.cache||"no-store"});
  }catch(error){
    throw new Error(`Backend connection failed. Make sure FastAPI is running on ${API_BASE_URL}.`);
  }
  if((response.status===401 || response.status===403) && retry){
    clearCustomerSession();
    window.location.replace("../login/login.html");
  }
  return response;
}

// Custom uploads live in IndexedDB while the item is in the basket.
// The actual file is sent to FastAPI only when the customer places the order.
const FILE_DB_NAME="visionaryCustomFilesV1";
const FILE_STORE="files";
function openFileDb(){
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open(FILE_DB_NAME,1);
    req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(FILE_STORE))req.result.createObjectStore(FILE_STORE);};
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error);
  });
}
async function saveCustomFile(key,file){
  const db=await openFileDb();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(FILE_STORE,"readwrite");
    tx.objectStore(FILE_STORE).put({blob:file,name:file.name,type:file.type||"application/octet-stream"},key);
    tx.oncomplete=()=>{db.close();resolve(true)}; tx.onerror=()=>{db.close();reject(tx.error)};
  });
}
async function getCustomFile(key){
  const db=await openFileDb();
  return new Promise((resolve,reject)=>{
    const req=db.transaction(FILE_STORE,"readonly").objectStore(FILE_STORE).get(key);
    req.onsuccess=()=>{const v=req.result;db.close();resolve(v?new File([v.blob],v.name,{type:v.type}):null)};
    req.onerror=()=>{db.close();reject(req.error)};
  });
}
async function deleteCustomFile(key){
  if(!key)return; const db=await openFileDb();
  return new Promise((resolve,reject)=>{const tx=db.transaction(FILE_STORE,"readwrite");tx.objectStore(FILE_STORE).delete(key);tx.oncomplete=()=>{db.close();resolve(true)};tx.onerror=()=>{db.close();reject(tx.error)}});
}

const BACKEND_NAME_BY_ID={
  "short-notes":"Short Notes Book", "crown-size":"Crown Size", "regular-long":"Regular Long", "bar-long":"Bar Long",
  "a4-paper":"A4 Size Paper Set", "7kg-long":"7kg Long Set Paper", "maha-bar-long":"Maha Bar Long (8kg)",
  "osr":"OSR Sheets", "thin-osr":"Thin OSR Sheets", "thick-osr":"Thick OSR Sheets", "files":"Files (Record)",
  "custom-books":"Customized Books", "exam-pads":"Exam Pads", "rough-books":"Rough Books"
};
function findBackendProduct(list,item){
  const expected=(
    item.backendName ||
    BACKEND_NAME_BY_ID[item.id] ||
    item.title ||
    ""
  ).trim().toLowerCase();

  return list.find(
    p=>String(p.name||"").trim().toLowerCase()===expected
  );
}
function normalizeOptionName(value){
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}
function findBackendOption(options, label){
  const target = normalizeOptionName(label);
  const exact = options.find(option => normalizeOptionName(option.option_name) === target);
  if (exact) return exact;
  const targetNumber = target.match(/^\d+/)?.[0];
  if (!targetNumber) return null;
  return options.find(option => normalizeOptionName(option.option_name).match(/^\d+/)?.[0] === targetNumber) || null;
}

function loadBasket(){
  try {
    const stored = JSON.parse(localStorage.getItem("visionaryBasketV2") || "[]");
    if (!Array.isArray(stored)) return [];
    return stored.filter(item => item && typeof item === "object" && item.id)
      .map(item => ({...item, backendName:item.backendName||BACKEND_NAME_BY_ID[item.id]||item.title}));
  } catch (error) {
    console.warn("Ignoring invalid saved basket data:", error);
    localStorage.removeItem("visionaryBasketV2");
    return [];
  }
}
let basket=loadBasket();
let selectedProduct=null,selectedOption=null,selectedQty=1,pdfPageCount=0,currentFilter="all";
const grid=document.getElementById("productGrid"),search=document.getElementById("productSearch"),empty=document.getElementById("noProductResults");
const money=n=>`\u20B9${Math.round(Number(n)||0).toLocaleString("en-IN")}`;
const esc=v=>String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
const visual=t=>t==="book"?'<div class="visual-book"></div>':t==="pad"?'<div class="visual-pad"></div>':t==="notebook"?'<div class="visual-notebook"></div>':'<div class="visual-print"></div>';
const unit=()=>!selectedProduct?0:selectedProduct.mode==="fixed"?selectedProduct.price:selectedProduct.mode==="pdf"?pdfPageCount:selectedOption?.[1]||0;

function renderProducts(){
  const q=search.value.trim().toLowerCase(), list=products.filter(p=>(currentFilter==="all"||p.category===currentFilter)&&(!q||`${p.title} ${p.short} ${p.desc}`.toLowerCase().includes(q)));
  grid.innerHTML=list.map(p=>`<div class="col-md-6 col-xl-3 product-col"><article class="product-card ${p.tone}">
    <div class="product-top"><div class="product-icon"><i class="bi ${p.icon}"></i></div><span class="product-index">${String(products.indexOf(p)+1).padStart(2,"0")}</span></div>
    <div class="product-visual">${visual(p.visual)}</div><div class="product-bottom"><div>
      <h3>${esc(p.title)}</h3><div class="product-short">${esc(p.short)}</div>
      <div class="product-meta-row"><span class="product-meta-chip">${p.mode==="pdf"?"PDF required":p.mode==="uploadOption"?"Artwork required":"No upload"}</span>${p.mode==="fixed"?`<span class="product-meta-chip">Each ${money(p.price)}</span>`:""}</div>
      <div class="price-tag">${p.mode==="fixed"?money(p.price):p.mode==="pdf"?"\u20B91 <small>/ PDF page</small>":"From "+money(p.options[0][1])}</div>
      <p class="product-desc">${esc(p.desc)}</p></div>
      <button class="product-action" data-product="${p.id}"><i class="bi bi-arrow-up-right"></i></button>
    </div></article></div>`).join("");
document.getElementById("productResultCount").textContent=`${list.length} product${list.length===1?"":"s"}${q?` matching "${esc(search.value)}"`:""}`;
  grid.classList.toggle("d-none",!list.length);empty.classList.toggle("d-none",!!list.length);
  grid.querySelectorAll(".product-action").forEach(b=>b.onclick=()=>openProduct(b.dataset.product));
}
document.querySelectorAll(".filter-pill").forEach(b=>b.onclick=()=>{document.querySelectorAll(".filter-pill").forEach(x=>x.classList.remove("active"));b.classList.add("active");currentFilter=b.dataset.filter;renderProducts();});
search.oninput=renderProducts;
document.getElementById("clearProductSearch").onclick=()=>{search.value="";renderProducts();search.focus();};
document.getElementById("resetProductSearch").onclick=()=>{currentFilter="all";document.querySelectorAll(".filter-pill").forEach(x=>x.classList.remove("active"));document.querySelector('[data-filter="all"]').classList.add("active");search.value="";renderProducts();};

function openProduct(id){
  selectedProduct=products.find(p=>p.id===id);selectedOption=selectedProduct.options?.[0]||null;selectedQty=1;pdfPageCount=0;
  document.getElementById("modalCategory").textContent=(selectedProduct.mode==="pdf"?"CUSTOM PDF BOOK":selectedProduct.mode==="uploadOption"?"CUSTOM EXAM PAD":selectedProduct.category).toUpperCase();
  document.getElementById("modalTitle").textContent=selectedProduct.title;document.getElementById("modalDescription").textContent=selectedProduct.desc;
  document.getElementById("modalVisual").innerHTML='<div class="modal-visual-book"></div>';renderFields();updateModal();
  bootstrap.Modal.getOrCreateInstance(document.getElementById("productModal")).show();
}
function renderFields(){
  let h="";
  if(selectedProduct.mode==="option"||selectedProduct.mode==="uploadOption")h+=`<div class="modal-field"><label>Pages / Set Size *</label><select id="productOption">${selectedProduct.options.map((o,i)=>`<option value="${i}">${o[0]} \u2014 ${money(o[1])}</option>`).join("")}</select></div><div class="modal-field"><label>Price</label><input id="modalUnitPrice" value="${money(selectedOption[1])}" readonly></div>`;
  if(selectedProduct.mode==="fixed")h+=`<div class="modal-field"><label>Unit price</label><input value="${money(selectedProduct.price)}" readonly></div><div class="modal-field"><label>Order type</label><input value="Quantity based" readonly></div>`;
  if(selectedProduct.mode==="pdf")h+=`<div class="modal-field modal-field-full"><label>Upload PDF * \u2014 \u20B91 per PDF page</label><label class="modal-upload required"><input type="file" id="customPdf" accept=".pdf,application/pdf"><i class="bi bi-cloud-arrow-up"></i><span><strong id="customPdfLabel">Choose PDF file</strong><small>PDF is read locally in your browser to count pages.</small></span><i class="bi bi-plus-circle ms-auto"></i></label></div>`;
  if(selectedProduct.mode==="uploadOption")h+=`<div class="modal-field"><label>School / College Name *</label><input id="examSchoolName" type="text" maxlength="255" placeholder="Enter school / college name" required></div><div class="modal-field modal-field-full"><label>School / College Logo or Title Artwork *</label><label class="modal-upload required"><input type="file" id="examArtwork" accept=".png,.jpg,.jpeg,.pdf,image/png,image/jpeg,application/pdf"><i class="bi bi-image"></i><span><strong id="examArtworkLabel">Upload image / single-page PDF</strong><small>Required for customized exam pad design.</small></span><i class="bi bi-plus-circle ms-auto"></i></label></div>`;
  document.getElementById("modalFields").innerHTML=h;document.getElementById("pdfCalcBox").classList.toggle("d-none",selectedProduct.mode!=="pdf");
  const opt=document.getElementById("productOption");if(opt)opt.onchange=()=>{selectedOption=selectedProduct.options[+opt.value];document.getElementById("modalUnitPrice").value=money(selectedOption[1]);updateModal();};
  const pdf=document.getElementById("customPdf");if(pdf)pdf.onchange=handlePdf;
  const art=document.getElementById("examArtwork");if(art)art.onchange=()=>document.getElementById("examArtworkLabel").textContent=art.files[0]?.name||"Upload image / single-page PDF";
}
async function handlePdf(e){
  const file=e.target.files?.[0];if(!file)return;
  document.getElementById("customPdfLabel").textContent=file.name;
  document.getElementById("pdfFileName").textContent=file.name;
  document.getElementById("pdfPageCount").textContent="Counting PDF pages...";;
  try{
    const bytes=await file.arrayBuffer();
    if(window.pdfjsLib){
      const doc=await window.pdfjsLib.getDocument({data:bytes}).promise;
      pdfPageCount=doc.numPages;
    }else{
      // Lightweight fallback for a basic PDF if the CDN library is unavailable.
      const text=new TextDecoder("latin1").decode(bytes);
      const matches=text.match(/\/Type\s*\/Page\b/g)||[];
      if(!matches.length)throw new Error("PDF reader unavailable");
      pdfPageCount=matches.length;
    }
    document.getElementById("pdfPageCount").textContent=`${pdfPageCount} page${pdfPageCount===1?"":"s"} \u00D7 \u20B91 per page`;
    document.getElementById("pdfCalculatedPrice").textContent=money(pdfPageCount);
    updateModal();
  }catch(err){
    console.error("PDF page count failed",err);pdfPageCount=0;
    document.getElementById("pdfPageCount").textContent="Could not read this PDF. Please choose another PDF.";
    document.getElementById("pdfCalculatedPrice").textContent="\u20B90";updateModal();
  }
}
function updateModal(){document.getElementById("qtyValue").textContent=selectedQty.toLocaleString("en-IN");document.getElementById("modalLiveTotal").textContent=money(unit()*selectedQty);if(selectedProduct?.mode==="pdf")document.getElementById("pdfCalculatedPrice").textContent=money(unit());}
document.getElementById("qtyMinus").onclick=()=>{selectedQty=Math.max(1,selectedQty-1);updateModal();};
document.getElementById("qtyPlus").onclick=()=>{selectedQty++;updateModal();};
document.getElementById("addToBasket").onclick=async()=>{
  if(selectedProduct.mode==="pdf"&&!pdfPageCount)return showToast("Please upload a valid PDF first.");
  const artwork=document.getElementById("examArtwork");
  if(selectedProduct.mode==="uploadOption"&&!artwork?.files?.length)return showToast("Please upload the school / college logo or title artwork.");
  if(selectedProduct.mode==="uploadOption"&&!(document.getElementById("examSchoolName")?.value||"").trim())return showToast("Please enter the school / college name.");

  const price=unit();
  const key=`${selectedProduct.id}|${selectedOption?.[0]||"standard"}|${selectedProduct.mode==="pdf"?pdfPageCount:"standard"}`;
  let old=basket.find(x=>x.key===key && (selectedProduct.mode!=="pdf" && selectedProduct.mode!=="uploadOption" || x.fileName===((selectedProduct.mode==="pdf"?document.getElementById("customPdf"):artwork)?.files?.[0]?.name||"")));

  if(selectedProduct.mode==="pdf" || selectedProduct.mode==="uploadOption"){
    const file=(selectedProduct.mode==="pdf"?document.getElementById("customPdf"):artwork).files[0];
    const fileKey=`${Date.now()}-${Math.random().toString(36).slice(2)}`;
    try{await saveCustomFile(fileKey,file);}catch(err){console.error(err);return showToast("Could not prepare the uploaded file. Please try again.");}
    const item={key:`${key}|${fileKey}`,id:selectedProduct.id,title:selectedProduct.title,backendName:BACKEND_NAME_BY_ID[selectedProduct.id],option:selectedOption?.[0]||(selectedProduct.mode==="pdf"?`${pdfPageCount} PDF pages`:"Standard"),qty:selectedQty,unitPrice:price,icon:selectedProduct.icon,customType:selectedProduct.mode==="pdf"?"customized-book":"exam-pad",fileKey,fileName:file.name,pageCount:selectedProduct.mode==="pdf"?pdfPageCount:null};
    if(selectedProduct.mode==="uploadOption")item.schoolCollegeName=(document.getElementById("examSchoolName")?.value||"").trim();
    basket.push(item);
  }else if(old){
    old.qty+=selectedQty;old.lineTotal=old.qty*old.unitPrice;
  }else{
    basket.push({key,id:selectedProduct.id,title:selectedProduct.title,backendName:BACKEND_NAME_BY_ID[selectedProduct.id],option:selectedOption?.[0]||"Standard",qty:selectedQty,unitPrice:price,icon:selectedProduct.icon});
  }
  saveBasket();bootstrap.Modal.getInstance(document.getElementById("productModal")).hide();showToast(`${selectedProduct.title} added to basket.`);
};

function totals(){const subtotal=basket.reduce((s,x)=>s+x.unitPrice*x.qty,0),discount=subtotal*DISCOUNT_RATE;return{subtotal,discount,total:subtotal-discount,units:basket.reduce((s,x)=>s+x.qty,0)};}
function saveBasket(){localStorage.setItem("visionaryBasketV2",JSON.stringify(basket));updateBasketUI();}
function updateBasketUI(){
  const t=totals();
  document.getElementById("cartCount").textContent=t.units.toLocaleString("en-IN");
  document.getElementById("mobileCartCount").textContent=t.units.toLocaleString("en-IN");
  document.getElementById("cartTotalItems").textContent=t.units.toLocaleString("en-IN");
  const items=document.getElementById("cartItems");
  document.getElementById("cartEmpty").classList.toggle("d-none",!!basket.length);
  document.getElementById("cartFooter").classList.toggle("d-none",!basket.length);
  items.innerHTML=basket.map((x,i)=>`<div class="cart-item"><div class="cart-item-visual"><i class="bi ${x.icon}"></i></div><div class="cart-item-info"><strong>${esc(x.title)}</strong><small>${esc(x.option)}${x.customType==="customized-book"?` • ${esc(x.fileName||"PDF")}`:x.customType==="exam-pad"?` • ${esc(x.fileName||"Artwork")}`:""} • Qty: <strong>${x.qty.toLocaleString("en-IN")}</strong></small><small>${money(x.unitPrice)} each • ${money(x.unitPrice*x.qty)}</small></div><button class="cart-item-remove" data-index="${i}"><i class="bi bi-trash3"></i></button></div>`).join("");
  items.querySelectorAll(".cart-item-remove").forEach(b=>b.onclick=async()=>{const item=basket[+b.dataset.index];if(item?.fileKey)await deleteCustomFile(item.fileKey).catch(()=>{});basket.splice(+b.dataset.index,1);saveBasket();showToast("Item removed from basket.");});
  document.getElementById("cartPriceSummary").innerHTML=`<div class="cart-price-row"><span>Subtotal</span><strong>${money(t.subtotal)}</strong></div><div class="cart-price-row discount"><span>Discount <span class="cart-discount-badge">10% OFF</span></span><strong>\u2212 ${money(t.discount)}</strong></div><div class="cart-price-row total"><span>Total</span><strong>${money(t.total)}</strong></div>`;
}

async function placeOrder(){
  if(!basket.length)return showToast("Your basket is empty.");
  if(!(await ensureCustomerSession()))return;
  const button=document.getElementById("placeOrderBtn");if(!button)return;
  const originalHTML=button.innerHTML;
  let completedCount=0;
  button.disabled=true;
  button.innerHTML='<span class="spinner-border spinner-border-sm me-2"></span>Placing Order...';
  try{
    const productsResponse=await apiFetch("/products/");
    if(!productsResponse.ok)throw new Error(`Could not load products (${productsResponse.status})`);
    const backendProducts=await productsResponse.json();
    const standardItems=basket.filter(item=>!item.customType);
    const customItems=basket.filter(item=>item.customType);

    if(standardItems.length){
      const items=[];
      for(const item of standardItems){
        const expectedName=item.backendName||BACKEND_NAME_BY_ID[item.id]||item.title;
        const backendProduct=findBackendProduct(backendProducts,item);
        if(!backendProduct)throw new Error(`Product not found in backend: ${expectedName}`);
        let productOptionId=null;
        if(item.option && item.option!=="Standard"){
          const optionsResponse=await apiFetch(`/products/${backendProduct.id}/options`);
          if(!optionsResponse.ok)throw new Error(`Could not load options for ${item.title}`);
          const options=await optionsResponse.json();
          const option=findBackendOption(options,item.option);
          if(!option)throw new Error(`Option "${item.option}" not found for ${item.title}`);
          productOptionId=option.id;
        }
        if(backendProduct.requires_pdf||backendProduct.requires_design)throw new Error(`${item.title} must use its upload flow.`);
        items.push({product_id:backendProduct.id,product_option_id:productOptionId,quantity:item.qty});
      }
      const response=await apiFetch("/orders/",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({items})});
      const data=await response.json().catch(()=>null);
      if(!response.ok)throw new Error(Array.isArray(data?.detail)?data.detail.map(x=>x.msg||JSON.stringify(x)).join(", "):data?.detail||`Order failed (${response.status})`);

      // Remove standard lines immediately after the server confirms their order.
      basket=basket.filter(item=>!standardItems.includes(item));
      completedCount+=standardItems.length;
      saveBasket();
    }

    for(const item of customItems){
      const file=await getCustomFile(item.fileKey);
      if(!file)throw new Error(`Uploaded file is missing for ${item.title}. Please add it again.`);
      const form=new FormData();
      form.append("copies",String(item.qty));
      form.append("pdf_file",file,file.name);
      let path="/custom-orders/customized-book";
      if(item.customType==="exam-pad"){
        const backendProduct=findBackendProduct(backendProducts,{id:"exam-pads",title:"Exam Pads",backendName:"Exam Pads"});
        if(!backendProduct)throw new Error("Exam Pads product not found in backend");
        const optionsResponse=await apiFetch(`/products/${backendProduct.id}/options`);
        if(!optionsResponse.ok)throw new Error("Could not load Exam Pad options");
        const options=await optionsResponse.json();
        const option=findBackendOption(options,item.option);
        if(!option)throw new Error(`Exam Pad option "${item.option}" not found in backend`);
        form.delete("pdf_file");
        form.append("design_file",file,file.name);
        form.append("product_option_id",String(option.id));
        form.append("school_college_name",item.schoolCollegeName||"");
        path="/custom-orders/exam-pad";
      }
      const response=await apiFetch(path,{method:"POST",body:form});
      const data=await response.json().catch(()=>null);
      if(!response.ok)throw new Error(data?.detail||`Custom order failed (${response.status})`);

      // Remove each custom line only after its own upload/order request succeeds.
      basket=basket.filter(existing=>existing!==item);
      completedCount++;
      saveBasket();
      if(item.fileKey)await deleteCustomFile(item.fileKey).catch(()=>{});
    }

    bootstrap.Offcanvas.getInstance(document.getElementById("cartCanvas"))?.hide();
    showToast("Order placed successfully. Your order is now Pending.");
  }catch(error){
    console.error("Place Order failed:",error);
    if(completedCount>0){
      showToast(`Some items were placed successfully. Remaining items are still in your basket. ${error.message}`);
    }else{
      showToast(`Order failed: ${error.message}`);
    }
  }finally{
    button.disabled=false;
    button.innerHTML=originalHTML;
  }
}

const placeOrderButton=document.getElementById("placeOrderBtn");
if(placeOrderButton)placeOrderButton.onclick=placeOrder;

/* Search overlay and existing site behavior */
const overlay=document.getElementById("searchOverlay"),globalSearch=document.getElementById("globalSearch");
function openSearch(){overlay.classList.add("show");setTimeout(()=>globalSearch.focus(),50);renderSearch("");}
function closeSearch(){overlay.classList.remove("show");globalSearch.value="";}
document.getElementById("searchBtn").onclick=openSearch;document.getElementById("footerSearch").onclick=openSearch;document.getElementById("searchClose").onclick=closeSearch;overlay.onclick=e=>{if(e.target===overlay)closeSearch();};document.addEventListener("keydown",e=>{if(e.key==="Escape")closeSearch();});
globalSearch.oninput=e=>renderSearch(e.target.value);
function renderSearch(term){const q=term.toLowerCase().trim(),found=products.filter(p=>`${p.title} ${p.short} ${p.category}`.toLowerCase().includes(q));document.getElementById("searchResults").innerHTML=found.length?found.map(p=>`<div class="search-result" data-id="${p.id}"><span><strong>${esc(p.title)}</strong><br><small>${esc(p.short)}</small></span><i class="bi bi-arrow-up-right"></i></div>`).join(""):'<div class="py-3 text-muted small">No products found.</div>';document.querySelectorAll(".search-result").forEach(x=>x.onclick=()=>{closeSearch();document.getElementById("products").scrollIntoView({behavior:"smooth"});openProduct(x.dataset.id);});}
document.getElementById("artwork").onchange=e=>document.getElementById("fileName").textContent=e.target.files[0]?.name||"Upload artwork / design";
document.getElementById("quoteForm").onsubmit=e=>{e.preventDefault();console.log("Frontend quote payload:",Object.fromEntries(new FormData(e.currentTarget).entries()),basket);showToast("Requirement captured in the frontend demo.");e.currentTarget.reset();document.getElementById("fileName").textContent="Upload artwork / design";};
window.addEventListener("scroll",()=>{document.getElementById("siteHeader").classList.toggle("scrolled",scrollY>15);const d=document.documentElement,m=d.scrollHeight-d.clientHeight;document.getElementById("scrollProgress").style.width=`${m?(scrollY/m)*100:0}%`;},{passive:true});
document.querySelectorAll("#mainNav .nav-link").forEach(a=>a.onclick=()=>{const n=document.getElementById("mainNav");if(n.classList.contains("show"))bootstrap.Collapse.getOrCreateInstance(n).hide();});
document.getElementById("cartBtn").onclick=()=>bootstrap.Offcanvas.getOrCreateInstance(document.getElementById("cartCanvas")).show();document.getElementById("mobileCart").onclick=()=>bootstrap.Offcanvas.getOrCreateInstance(document.getElementById("cartCanvas")).show();
function showToast(m){document.getElementById("toastMessage").textContent=m;bootstrap.Toast.getOrCreateInstance(document.getElementById("siteToast"),{delay:2600}).show();}
window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();window.deferredInstallPrompt=e;const b=document.getElementById("installBtn");b.hidden=false;b.onclick=async()=>{window.deferredInstallPrompt.prompt();await window.deferredInstallPrompt.userChoice;window.deferredInstallPrompt=null;b.hidden=true;}});
if("serviceWorker"in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("sw.js",{updateViaCache:"none"}).catch(()=>{}));
renderProducts();updateBasketUI();


/* Customer order history */
(function(){
  const ordersModalEl=document.getElementById("ordersModal");
  const ordersBtn=document.getElementById("myOrdersBtn");
  const refreshBtn=document.getElementById("refreshOrdersBtn");
  const retryBtn=document.getElementById("retryOrdersBtn");
  const loading=document.getElementById("ordersLoading");
  const loginState=document.getElementById("ordersLoginState");
  const emptyState=document.getElementById("ordersEmptyState");
  const errorState=document.getElementById("ordersErrorState");
  const errorText=document.getElementById("ordersErrorText");
  const list=document.getElementById("ordersList");
  const customHeading=document.getElementById("customOrdersHeading");
  const customList=document.getElementById("customOrdersList");

  if(!ordersModalEl || !ordersBtn) return;

  const modal=bootstrap.Modal.getOrCreateInstance(ordersModalEl);

  function setState(name){
    [loading,loginState,emptyState,errorState].forEach(el=>el.classList.add("d-none"));
    if(name==="loading")loading.classList.remove("d-none");
    if(name==="login")loginState.classList.remove("d-none");
    if(name==="empty")emptyState.classList.remove("d-none");
    if(name==="error")errorState.classList.remove("d-none");
  }

  function moneyLocal(value){
    const n=Number(value||0);
    return `\u20B9${n.toLocaleString("en-IN",{minimumFractionDigits:0,maximumFractionDigits:2})}`;
  }

  function escLocal(value){
    return String(value??"\u2014").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
  }

  function formatDate(value){
    if(!value)return "\u2014";
    const d=new Date(value);
    if(Number.isNaN(d.getTime()))return String(value);
    return d.toLocaleString("en-IN",{dateStyle:"medium",timeStyle:"short"});
  }

  function statusClass(status){
    return String(status||"Pending").toLowerCase().replace(/\s+/g,"-");
  }

  function statusStep(status){
    const statuses=["Pending","Confirmed","Processing","Ready","Completed"];
    const current=String(status||"Pending");
    if(current==="Cancelled")return -1;
    return statuses.indexOf(current);
  }

  function timeline(status){
    if(String(status)==="Cancelled"){
      return `<div class="order-cancelled"><i class="bi bi-x-circle"></i> This order was cancelled.</div>`;
    }
    const current=statusStep(status);
    const steps=[
      ["Pending","Order placed"],
      ["Confirmed","Confirmed"],
      ["Processing","Production / processing"],
      ["Ready","Ready for delivery or pickup"],
      ["Completed","Completed"]
    ];
    return `<div class="order-timeline">${steps.map((s,i)=>{
      const done=i<=current;
      return `<div class="timeline-step ${done?"done":""} ${i===current?"current":""}">
        <span class="timeline-dot">${done?"\u2713":""}</span> 
        <span>${escLocal(s[1])}</span>
      </div>`;
    }).join("")}</div>`;
  }

  function renderOrders(orders){
    if(!Array.isArray(orders) || !orders.length){
      list.innerHTML="";
      setState("empty");
      return;
    }
    setState("list");
    list.innerHTML=orders.map(order=>{
      const items=Array.isArray(order.items)?order.items:[];
      const status=order.status||"Pending";
      const itemsHtml=items.length
        ? items.map(item=>`<div class="order-item-row">
            <div><strong>${escLocal(item.product_name)}</strong>
            ${item.option_name?`<small>${escLocal(item.option_name)}</small>`:""}</div>
            <span>\u00D7 ${escLocal(item.quantity)}</span>
            <strong>${moneyLocal(item.item_total)}</strong>
          </div>`).join("")
        : `<div class="order-no-items">Item details are not available for this order.</div>`;

      return `<article class="customer-order-card">
        <div class="customer-order-head">
          <div>
            <span class="eyebrow">ORDER #${escLocal(order.id)}</span>
            <h4>${moneyLocal(order.total_amount)}</h4>
            <small>${escLocal(formatDate(order.created_at))}</small>
          </div>
          <span class="customer-status status-${statusClass(status)}">${escLocal(status)}</span>
        </div>
        ${timeline(status)}
        <div class="customer-order-items">${itemsHtml}</div>
        <div class="customer-order-summary">
          <span>Subtotal <b>${moneyLocal(order.subtotal)}</b></span>
          <span>Discount <b>\u2212 ${moneyLocal(order.discount_amount)}</b></span>
          <strong>Total <b>${moneyLocal(order.total_amount)}</b></strong>
        </div>
      </article>`;
    }).join("");
  }

  function renderCustomOrders(rows){
    if(!customList)return;
    if(!Array.isArray(rows)||!rows.length){customHeading?.classList.add("d-none");customList.innerHTML="";return;}
    customHeading?.classList.remove("d-none");
    customList.innerHTML=rows.map(row=>`<article class="customer-order-card custom-order-card"><div class="customer-order-head"><div><span class="eyebrow">CUSTOM #${escLocal(row.id)}</span><h4>${moneyLocal(row.total_amount)}</h4><small>${escLocal(formatDate(row.created_at))}</small></div><span class="customer-status status-${statusClass(row.status)}">${escLocal(row.status)}</span></div><div class="custom-order-meta"><strong>${escLocal(row.order_type)}</strong><span>${row.page_count?`${escLocal(row.page_count)} pages \u00D7 ${escLocal(row.copies)} copies`:row.order_type==="Exam Pad"?`${escLocal(row.school_college_name||"School / College")} • ${escLocal(row.copies)} sets`: `${escLocal(row.copies)} copies`}</span><small>${escLocal(row.file_name||"Uploaded design")}</small></div>${timeline(row.status)}</article>`).join("");
  }

  function getCustomerToken(){
    // Use the same JWT storage used by the working Place Order flow.
    const token=localStorage.getItem("visionaryAccessToken");
    return token && token.trim() ? token.trim() : null;
  }

  async function loadOrders(){
    if(!(await ensureCustomerSession())){
      setState("login");
      return;
    }
    const token=getAccessToken();
    console.log("My Orders authentication:", token ? "customer token found" : "customer token missing");

    if(!token){
      setState("login");
      return;
    }

    setState("loading");
    list.innerHTML="";
    try{
      if(!(await ensureCustomerSession())){
        setState("login");
        return;
      }
      const [response,customResponse]=await Promise.all([
        apiFetch(`/orders/my-orders`,{method:"GET",cache:"no-store",headers:{"Accept":"application/json","Cache-Control":"no-cache"}}),
        apiFetch(`/custom-orders/my-orders`,{method:"GET",cache:"no-store",headers:{"Accept":"application/json","Cache-Control":"no-cache"}})
      ]);
      const data=await response.json().catch(()=>null);
      const customData=await customResponse.json().catch(()=>null);
      if(!response.ok)throw new Error(data?.detail||`Could not load orders (${response.status})`);
      if(!customResponse.ok)throw new Error(customData?.detail||`Could not load custom orders (${customResponse.status})`);
      const standardOrders=Array.isArray(data)?data:(data?.orders||[]);
      const customOrders=Array.isArray(customData)?customData:[];
      renderOrders(standardOrders);
      renderCustomOrders(customOrders);
      if(customOrders.length)emptyState.classList.add("d-none");
    }catch(error){
      console.error("Load orders failed:",error);
      errorText.textContent=error.message||"Could not load your orders.";
      setState("error");
    }
  }

  ordersBtn.addEventListener("click",()=>{
    modal.show();
  });
  refreshBtn?.addEventListener("click",loadOrders);
  retryBtn?.addEventListener("click",loadOrders);

  ordersModalEl.addEventListener("shown.bs.modal",()=>{
    // Always fetch the latest orders whenever the My Orders modal is opened.
    // This keeps newly placed orders and admin status changes visible immediately.
    loadOrders();
  });
})();


/* Customer profile: name and phone are permanent; only address/location can change. */
(function(){
  const profileBtn=document.getElementById("profileBtn"), profileModalEl=document.getElementById("profileModal");
  if(!profileBtn||!profileModalEl)return;
  const modal=bootstrap.Modal.getOrCreateInstance(profileModalEl);
  const loading=document.getElementById("profileLoading"),form=document.getElementById("profileForm");
  const phoneEl=document.getElementById("profilePhoneDisplay"),phoneReadonly=document.getElementById("profilePhoneReadonly"),nameEl=document.getElementById("profileNameInput"),addressEl=document.getElementById("profileAddressInput"),locationEl=document.getElementById("profileLocationInput");
  const messageEl=document.getElementById("profileSaveMessage"),saveBtn=document.getElementById("saveProfileBtn"),logoutBtn=document.getElementById("logoutBtn"),locBtn=document.getElementById("profileUseLocationBtn"),locStatus=document.getElementById("profileLocationStatus");
  const showMessage=(m,ok=false)=>{messageEl.textContent=m;messageEl.className=`profile-message ${ok?"success":"error"}`};
  async function loadProfile(){
    loading.classList.remove("d-none");form.classList.add("d-none");messageEl.textContent="";
    try{if(!(await ensureCustomerSession()))return;const r=await apiFetch("/customers/me/profile",{headers:{Accept:"application/json"}});const d=await r.json();if(!r.ok)throw new Error(d?.detail||"Could not load profile.");
      phoneEl.textContent=d.phone||"\u2014";if(phoneReadonly)phoneReadonly.value=d.phone||"";nameEl.value=d.name||"";addressEl.value=d.address||"";locationEl.value=d.location||"";localStorage.setItem("visionaryCustomerProfileV3",JSON.stringify(d));form.classList.remove("d-none");
    }catch(e){showMessage(e.message||"Could not load profile.");form.classList.remove("d-none");}finally{loading.classList.add("d-none");}
  }
  locBtn?.addEventListener("click",()=>{
    showMessage("");if(!navigator.geolocation){showMessage("Location is not supported by this browser.");return;}
    locStatus.textContent="Getting your location...";
    navigator.geolocation.getCurrentPosition(async pos=>{
      const lat=pos.coords.latitude,lon=pos.coords.longitude;locationEl.value=`${lat.toFixed(6)}, ${lon.toFixed(6)}`;locStatus.textContent="Location captured. Converting to address...";      try{const r=await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`,{headers:{Accept:"application/json"}});const d=await r.json();if(d.display_name)addressEl.value=d.display_name;locStatus.textContent="Location updated. Review the address and save.";}catch(_){locStatus.textContent="Coordinates captured. Please review/update the address.";}finally{locBtn.disabled=false;}
    },()=>{locStatus.textContent="Location permission was not available. You can edit the address manually.";locBtn.disabled=false;},{enableHighAccuracy:true,timeout:12000,maximumAge:0});
  });
  profileBtn.addEventListener("click",async()=>{modal.show();await loadProfile();});
  form.addEventListener("submit",async e=>{e.preventDefault();if(!(await ensureCustomerSession()))return;const address=addressEl.value.trim(),location=locationEl.value.trim();if(address.length<5){showMessage("Please enter a complete address.");return;}saveBtn.disabled=true;saveBtn.textContent="Saving...";
    try{const r=await apiFetch("/customers/me/profile",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({address,location:location||null})});const d=await r.json();if(!r.ok)throw new Error(d?.detail||"Could not save profile.");localStorage.setItem("visionaryCustomerProfileV3",JSON.stringify(d.customer));showMessage("Address updated successfully.",true);}catch(err){showMessage(err.message||"Could not save profile.");}finally{saveBtn.disabled=false;saveBtn.textContent="Save Changes";}
  });
  logoutBtn.addEventListener("click",()=>{clearCustomerSession();bootstrap.Modal.getInstance(profileModalEl)?.hide();window.location.replace("../login/login.html");});
})();

window.addEventListener("load",()=>{ensureCustomerSession().catch(()=>{});});
/* Mobile customer account actions */
(function(){
  const accountActions = document.getElementById("mobileAccountActions");
  const mobileOrdersBtn = document.getElementById("mobileMyOrdersBtn");
  const mobileProfileBtn = document.getElementById("mobileProfileBtn");

  if(!accountActions || !mobileOrdersBtn || !mobileProfileBtn) return;

  function updateMobileAccountActions(){
    const token = getAccessToken();
    accountActions.classList.toggle("is-visible", !!token);
  }

  mobileOrdersBtn.addEventListener("click",()=>{
    const desktopOrdersBtn = document.getElementById("myOrdersBtn");
    if(desktopOrdersBtn){
      desktopOrdersBtn.click();
    }
  });

  mobileProfileBtn.addEventListener("click",()=>{
    const desktopProfileBtn = document.getElementById("profileBtn");
    if(desktopProfileBtn){
      desktopProfileBtn.click();
    }
  });

  updateMobileAccountActions();

  window.addEventListener("storage",updateMobileAccountActions);

  setInterval(updateMobileAccountActions,1000);
})();
