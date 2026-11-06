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
const TOKEN_KEY = "visionaryAdminAccessToken";

const form = document.getElementById("adminLoginForm");
const btn = document.getElementById("loginBtn");
const spinner = document.getElementById("loginSpinner");
const btnText = btn.querySelector(".btn-text");
const errorBox = document.getElementById("loginError");

if (localStorage.getItem(TOKEN_KEY)) {
  window.location.href = "dashboard.html";
}

function showError(message) {
  errorBox.textContent = message;
  errorBox.classList.remove("d-none");
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  errorBox.classList.add("d-none");

  const phone = document.getElementById("phone").value.trim();
  const pin = document.getElementById("pin").value.trim();

  if (!phone || !pin) {
    showError("Enter the admin phone number and PIN.");
    return;
  }

  btn.disabled = true;
  spinner.classList.remove("d-none");
  btnText.textContent = "Signing in...";

  try {
    const url = `${API_BASE}/auth/admin/login?phone=${encodeURIComponent(phone)}&pin=${encodeURIComponent(pin)}`;
    const response = await fetch(url, { method: "POST" });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.detail || "Admin login failed.");
    }

    if (!data.access_token) {
      throw new Error("The server did not return an admin access token.");
    }

    localStorage.setItem(TOKEN_KEY, data.access_token);
    window.location.href = "dashboard.html";
  } catch (error) {
    showError(error.message || "Unable to connect to the backend.");
  } finally {
    btn.disabled = false;
    spinner.classList.add("d-none");
    btnText.textContent = "Sign in";
  }
});

