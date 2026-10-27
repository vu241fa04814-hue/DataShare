// ========================================
// DataShare - Complete Frontend JavaScript
// ========================================

const textTab = document.getElementById("textTab");
const fileTab = document.getElementById("fileTab");

const textView = document.getElementById("textView");
const fileView = document.getElementById("fileView");

const textInput = document.getElementById("textInput");
const counter = document.getElementById("counter");

const fileInput = document.getElementById("fileInput");
const dropzone = document.getElementById("dropzone");
const filePrompt = document.getElementById("filePrompt");
const fileInfo = document.getElementById("fileInfo");

const generateButton = document.getElementById("generateButton");
const shareResult = document.getElementById("shareResult");
const sendError = document.getElementById("sendError");

const retrieveForm = document.getElementById("retrieveForm");
const codeInputs = [
    ...document.querySelectorAll(".code-input")
];
const retrieveButton = document.getElementById("retrieveButton");

const receiveResult = document.getElementById("receiveResult");
const receiveError = document.getElementById("receiveError");

let mode = "text";
let selectedFile = null;
let lastRetrievedCode = "";
let isRetrieving = false;


// ========================================
// Show messages and errors
// ========================================

function clearMessage(element) {
    element.classList.add("hidden");
    element.textContent = "";
}

function showError(element, message) {
    element.textContent = message;
    element.classList.remove("hidden");
}

function showResult(element, html) {
    element.innerHTML = html;
    element.classList.remove("hidden");
}


// ========================================
// Security: Escape HTML
// ========================================

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[character]);
}


// ========================================
// Format file sizes
// ========================================

function formatBytes(bytes) {
    if (bytes < 1024) {
        return `${bytes} B`;
    }

    if (bytes < 1048576) {
        return `${(bytes / 1024).toFixed(1)} KB`;
    }

    return `${(bytes / 1048576).toFixed(1)} MB`;
}


// ========================================
// Switch between Text and File modes
// ========================================

function setMode(nextMode) {
    mode = nextMode;

    const isText = mode === "text";

    textTab.classList.toggle("active", isText);
    fileTab.classList.toggle("active", !isText);

    textTab.setAttribute("aria-selected", String(isText));
    fileTab.setAttribute("aria-selected", String(!isText));

    textView.classList.toggle("hidden", !isText);
    fileView.classList.toggle("hidden", isText);

    generateButton.innerHTML = isText
        ? "➤ &nbsp; Generate Share Code"
        : "➤ &nbsp; Upload File & Generate Code";

    updateGenerateButton();

    clearMessage(sendError);
    clearMessage(shareResult);
}

textTab.addEventListener("click", () => {
    setMode("text");
});

fileTab.addEventListener("click", () => {
    setMode("file");
});


// ========================================
// Text counter
// ========================================

function updateCounter() {
    const value = textInput.value;

    const lines = value
        ? value.split("\n").length
        : 0;

    counter.textContent =
        `${value.length} chars • ${lines} lines`;

    updateGenerateButton();
}

textInput.addEventListener("input", updateCounter);


// ========================================
// Enable or disable Generate button
// ========================================

function updateGenerateButton() {
    generateButton.disabled = mode === "text"
        ? !textInput.value.trim()
        : !selectedFile;
}


// ========================================
// File selection
// ========================================

function setFile(file) {
    if (!file) {
        return;
    }

    if (file.size > 100 * 1024 * 1024) {
        showError(
            sendError,
            "The maximum file size is 100 MB."
        );
        return;
    }

    selectedFile = file;

    filePrompt.textContent = file.name;

    fileInfo.textContent =
        `${formatBytes(file.size)} selected`;

    updateGenerateButton();

    clearMessage(sendError);
    clearMessage(shareResult);
}

fileInput.addEventListener("change", () => {
    setFile(fileInput.files[0]);
});

["dragenter", "dragover"].forEach(eventName => {
    dropzone.addEventListener(eventName, event => {
        event.preventDefault();
        dropzone.classList.add("dragover");
    });
});

["dragleave", "drop"].forEach(eventName => {
    dropzone.addEventListener(eventName, event => {
        event.preventDefault();
        dropzone.classList.remove("dragover");
    });
});

dropzone.addEventListener("drop", event => {
    setFile(event.dataTransfer.files[0]);
});

document.addEventListener("paste", event => {
    if (mode !== "file") {
        return;
    }

    const item = [
        ...(event.clipboardData?.items || [])
    ].find(item => item.kind === "file");

    if (item) {
        setFile(item.getAsFile());
    }
});


// ========================================
// Generate Share Code
// ========================================

generateButton.addEventListener("click", async () => {
    clearMessage(sendError);
    clearMessage(shareResult);

    generateButton.disabled = true;
    generateButton.textContent = "Creating share code...";

    try {
        let response;

        if (mode === "text") {
            response = await fetch("/api/share/text", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    text: textInput.value,
                    expiryHours:
                        document.getElementById("expiryHours").value
                })
            });
        } else {
            if (!selectedFile) {
                throw new Error("Please select a file first.");
            }

            const formData = new FormData();

            formData.append("file", selectedFile);

            formData.append(
                "expiryHours",
                document.getElementById("expiryHours").value
            );

            response = await fetch("/api/share/file", {
                method: "POST",
                body: formData
            });
        }

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.error || "Could not create share code."
            );
        }

        showResult(
            shareResult,
            `
                <strong>Share code created successfully!</strong>

                <div class="code-display">
                    <span class="code-number">
                        ${escapeHtml(data.code)}
                    </span>

                    <button
                        class="small-button"
                        id="copyCodeButton"
                        type="button"
                    >
                        Copy code
                    </button>
                </div>

                <p>
                    Share this six-digit code with the receiver.
                    Expires:
                    ${escapeHtml(
                        new Date(data.expiresAt).toLocaleString()
                    )}
                </p>
            `
        );

        const copyCodeButton =
            document.getElementById("copyCodeButton");

        copyCodeButton.addEventListener("click", async () => {
            try {
                await navigator.clipboard.writeText(
                    String(data.code)
                );

                copyCodeButton.textContent = "Copied!";
            } catch {
                copyCodeButton.textContent = String(data.code);
            }
        });

    } catch (error) {
        showError(
            sendError,
            error.message || "Network error. Is the server running?"
        );
    } finally {
        generateButton.innerHTML = mode === "text"
            ? "➤ &nbsp; Generate Share Code"
            : "➤ &nbsp; Upload File & Generate Code";

        updateGenerateButton();
    }
});


// ========================================
// Receive Code Input
// ========================================

function updateRetrieveButton() {
    retrieveButton.disabled =
        codeInputs.length !== 6 ||
        codeInputs.some(input => !/^\d$/.test(input.value)) ||
        isRetrieving;
}

function getEnteredCode() {
    return codeInputs.map(input => input.value).join("");
}

function clearCodeInputs() {
    codeInputs.forEach(input => {
        input.value = "";
    });

    lastRetrievedCode = "";

    updateRetrieveButton();
}

codeInputs.forEach((input, index) => {

    input.addEventListener("input", () => {
        input.value = input.value
            .replace(/\D/g, "")
            .slice(-1);

        clearMessage(receiveError);
        clearMessage(receiveResult);

        lastRetrievedCode = "";

        if (input.value && index < codeInputs.length - 1) {
            codeInputs[index + 1].focus();
        }

        updateRetrieveButton();

        // Automatically retrieve after all six digits are entered.
        if (
            codeInputs.length === 6 &&
            codeInputs.every(field => /^\d$/.test(field.value))
        ) {
            retrieveForm.requestSubmit();
        }
    });

    input.addEventListener("keydown", event => {
        if (
            event.key === "Backspace" &&
            !input.value &&
            index > 0
        ) {
            codeInputs[index - 1].focus();
        }

        if (event.key === "ArrowLeft" && index > 0) {
            codeInputs[index - 1].focus();
        }

        if (
            event.key === "ArrowRight" &&
            index < codeInputs.length - 1
        ) {
            codeInputs[index + 1].focus();
        }
    });

    input.addEventListener("paste", event => {
        const pasted = event.clipboardData
            .getData("text")
            .replace(/\D/g, "")
            .slice(0, 6);

        if (!pasted) {
            return;
        }

        event.preventDefault();

        clearMessage(receiveError);
        clearMessage(receiveResult);

        lastRetrievedCode = "";

        pasted.split("").forEach((digit, digitIndex) => {
            if (codeInputs[digitIndex]) {
                codeInputs[digitIndex].value = digit;
            }
        });

        const nextIndex = Math.min(
            pasted.length,
            codeInputs.length - 1
        );

        codeInputs[nextIndex].focus();

        updateRetrieveButton();

        if (
            codeInputs.length === 6 &&
            codeInputs.every(field => /^\d$/.test(field.value))
        ) {
            retrieveForm.requestSubmit();
        }
    });
});


// ========================================
// Retrieve Content Automatically
// ========================================

retrieveForm.addEventListener("submit", async event => {
    event.preventDefault();

    const code = getEnteredCode();

    if (!/^\d{6}$/.test(code)) {
        showError(
            receiveError,
            "Please enter all six digits of the share code."
        );
        return;
    }

    if (isRetrieving) {
        return;
    }

    if (code === lastRetrievedCode) {
        return;
    }

    isRetrieving = true;
    lastRetrievedCode = code;

    clearMessage(receiveError);
    clearMessage(receiveResult);

    retrieveButton.disabled = true;
    retrieveButton.textContent = "Retrieving...";

    try {
        const response = await fetch(
            `/api/share/${encodeURIComponent(code)}`
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.error || "Could not retrieve content."
            );
        }

        if (data.type === "text") {

            // Put retrieved text into the Send Content text box.
            setMode("text");

            textInput.value = data.text || "";

            updateCounter();

            // Show the received text in Receive Content too.
            showResult(
                receiveResult,
                `
                    <strong>Text received successfully!</strong>

                    <div class="content-text">
                        ${escapeHtml(data.text || "")}
                    </div>

                    <button
                        class="small-button"
                        id="copyTextButton"
                        type="button"
                    >
                        Copy text
                    </button>

                    <p>
                        Expires:
                        ${escapeHtml(
                            new Date(data.expiresAt).toLocaleString()
                        )}
                    </p>
                `
            );

            const copyTextButton =
                document.getElementById("copyTextButton");

            copyTextButton.addEventListener("click", async () => {
                try {
                    await navigator.clipboard.writeText(
                        data.text || ""
                    );

                    copyTextButton.textContent = "Copied!";
                } catch {
                    copyTextButton.textContent = "Copy failed";
                }
            });

        } else if (data.type === "file") {

            showResult(
                receiveResult,
                `
                    <strong>File is ready to download!</strong>

                    <p>
                        ${escapeHtml(data.fileName)}
                        · ${formatBytes(data.size)}
                    </p>

                    <a
                        class="download-link"
                        href="${escapeHtml(data.downloadUrl)}"
                    >
                        ⇩ Download file
                    </a>

                    <p>
                        Expires:
                        ${escapeHtml(
                            new Date(data.expiresAt).toLocaleString()
                        )}
                    </p>
                `
            );

        } else {
            throw new Error("The server returned an unknown content type.");
        }

    } catch (error) {
        lastRetrievedCode = "";

        showError(
            receiveError,
            error.message || "Network error. Please try again."
        );

    } finally {
        isRetrieving = false;

        retrieveButton.textContent = "⇩  Retrieve Content";

        updateRetrieveButton();
    }
});


// ========================================
// Initialize the application
// ========================================

updateCounter();
updateRetrieveButton();