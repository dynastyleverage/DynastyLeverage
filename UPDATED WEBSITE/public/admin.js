const tokenInput = document.querySelector("#tokenInput");
const modeInput = document.querySelector("#modeInput");
const jsonInput = document.querySelector("#jsonInput");
const sampleButton = document.querySelector("#sampleButton");
const importButton = document.querySelector("#importButton");
const adminStatus = document.querySelector("#adminStatus");

const sample = [
  {
    id: "patrick-mahomes",
    name: "Patrick Mahomes",
    team: "KC",
    position: "QB",
    type: "player",
    value: 6700,
    age: 30,
    tier: 2
  },
  {
    id: "2028-1st",
    name: "2028 1st",
    team: "PICK",
    position: "PICK",
    type: "pick",
    value: 3900,
    age: null,
    tier: 5
  }
];

function setStatus(message, isError = false) {
  adminStatus.textContent = message;
  adminStatus.classList.toggle("is-error", isError);
}

sampleButton.addEventListener("click", () => {
  jsonInput.value = JSON.stringify(sample, null, 2);
  setStatus("Sample loaded. Edit values, then import.");
});

importButton.addEventListener("click", async () => {
  let assets;
  try {
    assets = JSON.parse(jsonInput.value);
  } catch (error) {
    setStatus(`JSON error: ${error.message}`, true);
    return;
  }

  try {
    importButton.disabled = true;
    setStatus("Importing...");
    const response = await fetch("/api/admin/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: tokenInput.value,
        mode: modeInput.value,
        assets
      })
    });
    const data = await response.json();

    if (!response.ok) {
      setStatus(data.error || "Import failed.", true);
      return;
    }

    setStatus(`${data.message}\nBefore: ${data.before}\nAfter: ${data.after}`);
  } catch (error) {
    setStatus(`Import failed: ${error.message}`, true);
  } finally {
    importButton.disabled = false;
  }
});

jsonInput.value = JSON.stringify(sample, null, 2);
