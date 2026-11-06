const $=id=>document.getElementById(id);
const IS_LOCAL_HOST = (() => {
  const host = location.hostname;
  if (host === "localhost" || host === "127.0.0.1") return true;
  const parts = host.split(".").map(Number);
  if (parts.length !== 4 || parts.some(n => !Number.isInteger(n) || n < 0 || n > 255)) return false;
  return parts[0] === 10 ||
    (parts[0] === 192 && parts[1] === 168) ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31);
})();
const API_BASE = IS_LOCAL_HOST
  ? `${location.protocol}//${location.hostname}:8000`
  : location.origin;
const TOKEN_KEY='visionaryAccessToken';
const PROFILE_KEY='visionaryCustomerProfileV3';
const AUTH_KEY='visionaryCustomerAuthV3';

function clearOldSession(){
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem('visionaryRefreshToken');
  localStorage.removeItem(AUTH_KEY);
  localStorage.removeItem('visionaryCustomerLoginMethodV3');
}

function showError(id,msg){const e=$(id);e.textContent=msg;e.style.display='block';}
function clearError(id){const e=$(id);e.textContent='';e.style.display='none';}
function validPhone(value){return /^\d{10}$/.test(String(value||'').trim());}
function validPin(value){return /^\d{6}$/.test(String(value||'').trim());}

function setMode(mode){
  const existing=mode==='existing';
  $('existingUserTab').classList.toggle('active',existing);
  $('newUserTab').classList.toggle('active',!existing);
  $('existingUserStep').classList.toggle('active',existing);
  $('newUserStep').classList.toggle('active',!existing);
  clearError('loginError');clearError('newUserError');
}

$('existingUserTab').onclick=()=>setMode('existing');
$('newUserTab').onclick=()=>setMode('new');
$('backToExisting').onclick=()=>setMode('existing');

async function api(path,options={}){
  const headers=new Headers(options.headers||{});
  if(!(options.body instanceof FormData)&&options.body&&!headers.has('Content-Type'))headers.set('Content-Type','application/json');
  const response=await fetch(`${API_BASE}${path}`,{...options,headers,cache:'no-store'});
  const data=await response.json().catch(()=>null);
  if(!response.ok){
    const detail=data?.detail;
    const message=Array.isArray(detail)?detail.map(x=>x.msg||JSON.stringify(x)).join(', '):(detail||`Request failed (${response.status})`);
    const error=new Error(message);error.status=response.status;throw error;
  }
  return data;
}

async function restoreExistingSession(){
  // No refresh-token system: a customer session lasts exactly 3 hours.
  // If an old 90-day refresh token exists from the previous build, remove it.
  localStorage.removeItem('visionaryRefreshToken');
  const access=localStorage.getItem(TOKEN_KEY);
  if(!access)return;
  try{
    const payload=JSON.parse(atob(access.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));
    if(payload.exp && Date.now()/1000 < Number(payload.exp)){
      location.replace('/');return;
    }
  }catch(_){/* expired/corrupt */}
  clearOldSession();
}
restoreExistingSession();

$('loginButton').onclick=async()=>{
  clearError('loginError');
  const phone=$('loginPhone').value.trim(),pin=$('loginPin').value.trim();
  if(!validPhone(phone)){showError('loginError','Enter a valid 10-digit mobile number. Do not add +91.');return;}
  if(!validPin(pin)){showError('loginError','Your PIN must be exactly 6 digits.');return;}
  const button=$('loginButton');button.disabled=true;button.innerHTML='Checking...';
  try{
    const data=await api('/auth/customer/login',{method:'POST',body:JSON.stringify({phone,pin})});
    localStorage.setItem(TOKEN_KEY,data.access_token);
    localStorage.setItem(PROFILE_KEY,JSON.stringify(data.customer));
    localStorage.setItem(AUTH_KEY,'true');
    localStorage.setItem('visionaryCustomerLoginMethodV3','customer-pin');
    location.replace('/');
  }catch(error){showError('loginError',error.message||'Login failed.');}
  finally{button.disabled=false;button.innerHTML='Login <i class="bi bi-arrow-right"></i>';}
};

let newCoords=null;
$('newUseLocation').onclick=()=>{
  clearError('newUserError');
  if(!navigator.geolocation){showError('newUserError','Location is not supported by this browser. You can enter the address manually.');return;}
  $('newLocationStatus').innerHTML='<strong>Getting your location…</strong>Please allow location access in the browser prompt.';
  $('newUseLocation').disabled=true;
  navigator.geolocation.getCurrentPosition(async pos=>{
    newCoords={latitude:pos.coords.latitude,longitude:pos.coords.longitude,accuracy:pos.coords.accuracy};
    $('newLocationCoords').textContent=`Coordinates captured: ${newCoords.latitude.toFixed(6)}, ${newCoords.longitude.toFixed(6)}`;
    try{
      const r=await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${newCoords.latitude}&lon=${newCoords.longitude}`,{headers:{Accept:'application/json'}});
      const data=await r.json();
      if(data.display_name)$('newAddress').value=data.display_name;
      $('newLocationStatus').innerHTML='<strong>Location captured</strong>Review the address before creating your account.';
    }catch(_){$('newLocationStatus').innerHTML='<strong>Coordinates captured</strong>Please enter or review the address manually.';}
    $('newUseLocation').disabled=false;
  },()=>{
    $('newLocationStatus').innerHTML='<strong>Location not captured</strong>You can continue by entering the address manually.';
    $('newUseLocation').disabled=false;
  },{enableHighAccuracy:true,timeout:12000,maximumAge:0});
};

$('createAccountButton').onclick=async()=>{
  clearError('newUserError');
  const name=$('newName').value.trim(),phone=$('newPhone').value.trim(),pin=$('newPin').value.trim(),confirm=$('confirmPin').value.trim(),address=$('newAddress').value.trim();
  if(name.length<2){showError('newUserError','Please enter your full name.');return;}
  if(!validPhone(phone)){showError('newUserError','Enter a valid 10-digit mobile number. Do not add +91.');return;}
  if(!validPin(pin)){showError('newUserError','Create a PIN with exactly 6 digits.');return;}
  if(pin!==confirm){showError('newUserError','PIN and Confirm PIN do not match.');return;}
  if(address.length<5){showError('newUserError','Please enter a complete delivery address or use My Location.');return;}
  const button=$('createAccountButton');button.disabled=true;button.innerHTML='Creating...';
  try{
    const locationValue=newCoords?`${newCoords.latitude},${newCoords.longitude}`:null;
    const data=await api('/customers/register',{method:'POST',body:JSON.stringify({name,phone,pin,address,location:locationValue})});
    // Registration creates the permanent profile; immediately issue the 3-hour session.
    const login=await api('/auth/customer/login',{method:'POST',body:JSON.stringify({phone,pin})});
    localStorage.setItem(TOKEN_KEY,login.access_token);
    localStorage.setItem(PROFILE_KEY,JSON.stringify(login.customer||data.customer));
    localStorage.setItem(AUTH_KEY,'true');
    localStorage.setItem('visionaryCustomerLoginMethodV3','new-customer-pin');
    location.replace('/');
  }catch(error){
    if(error.status===409)showError('newUserError','This mobile number is already registered. Try a different number, or choose “Already a user” and login with this number and PIN.');
    else showError('newUserError',error.message||'Could not create the account.');
  }finally{button.disabled=false;button.innerHTML='Create Account <i class="bi bi-check2"></i>';}
};


