// share.js – QR code + URL sharing for lists

let itemsArray = [];

const listItemInput = document.getElementById("listItemInput");
const addItemBtn = document.getElementById("addItemBtn");
const listItems = document.getElementById("listItems");
const shareBtn = document.getElementById("shareBtn");
const shareSection = document.getElementById("shareSection");
const viewSection = document.getElementById("viewSection");
const viewListItems = document.getElementById("viewListItems");
const shareUrl = document.getElementById("shareUrl");
const copyUrlBtn = document.getElementById("copyUrlBtn");
const newListBtn = document.getElementById("newListBtn");
const backBtn = document.getElementById("backBtn");

function updateListDisplay() {
  listItems.innerHTML = "";
  itemsArray.forEach((item, index) => {
    const li = document.createElement("li");
    li.textContent = item;
    const removeBtn = document.createElement("button");
    removeBtn.textContent = "Remove";
    removeBtn.className = "remove-btn";
    removeBtn.addEventListener("click", () => {
      itemsArray.splice(index, 1);
      updateListDisplay();
      updateShareButton();
    });
    li.appendChild(removeBtn);
    listItems.appendChild(li);
  });
  updateShareButton();
}

function updateShareButton() {
  shareBtn.disabled = itemsArray.length === 0;
}

function generateShareUrl(data) {
  const json = JSON.stringify(data);
  const encoded = btoa(json);
  const baseUrl = window.location.origin + window.location.pathname.replace(/[^/]*$/, "");
  return `${baseUrl}share.html?list=${encoded}`;
}

function generateQRCode(url) {
  const qrContainer = document.getElementById("qrcode");
  qrContainer.innerHTML = "";
  new QRCode(qrContainer, {
    text: url,
    width: 200,
    height: 200,
    colorDark: "#1a1a2e",
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.M
  });
}

function showShareSection() {
  const data = { items: itemsArray, timestamp: Date.now() };
  const url = generateShareUrl(data);
  
  shareUrl.value = url;
  generateQRCode(url);
  
  shareSection.classList.remove("hidden");
  document.querySelector(".section:not(#shareSection):not(#viewSection)").classList.add("hidden");
}

function loadSharedList() {
  const params = new URLSearchParams(window.location.search);
  const encoded = params.get("list");
  
  if (encoded) {
    try {
      const json = atob(encoded);
      const data = JSON.parse(json);
      
      if (data.items && Array.isArray(data.items)) {
        viewListItems.innerHTML = "";
        data.items.forEach(item => {
          const li = document.createElement("li");
          li.textContent = item;
          viewListItems.appendChild(li);
        });
        
        viewSection.classList.remove("hidden");
        document.querySelector(".section:not(#viewSection):not(#shareSection)").classList.add("hidden");
        shareSection.classList.add("hidden");
        return true;
      }
    } catch (e) {
      console.warn("Failed to decode shared list:", e);
    }
  }
  return false;
}

addItemBtn.addEventListener("click", () => {
  const value = listItemInput.value.trim();
  if (value) {
    itemsArray.push(value);
    listItemInput.value = "";
    updateListDisplay();
    listItemInput.focus();
  }
});

listItemInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    addItemBtn.click();
  }
});

shareBtn.addEventListener("click", showShareSection);

copyUrlBtn.addEventListener("click", () => {
  shareUrl.select();
  document.execCommand("copy");
  copyUrlBtn.textContent = "Copied!";
  setTimeout(() => {
    copyUrlBtn.textContent = "Copy";
  }, 2000);
});

newListBtn.addEventListener("click", () => {
  itemsArray = [];
  updateListDisplay();
  shareSection.classList.add("hidden");
  document.querySelector(".section:not(#shareSection):not(#viewSection)").classList.remove("hidden");
  window.history.replaceState({}, "", window.location.pathname);
});

backBtn.addEventListener("click", () => {
  window.history.replaceState({}, "", window.location.pathname);
  viewSection.classList.add("hidden");
  document.querySelector(".section:not(#viewSection):not(#shareSection)").classList.remove("hidden");
});

updateShareButton();

if (!loadSharedList()) {
  listItemInput.focus();
}
