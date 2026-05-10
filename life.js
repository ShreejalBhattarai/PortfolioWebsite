(function () {
  /**
   * Owner-only editing (static site limitation):
   * Replace LIFE_ALBUM_ADMIN_SECRET with your own passphrase before you deploy.
   * Anyone who reads this file or watches network traffic could still learn it—this
   * only hides controls from normal visitors; it is not server-grade security.
   *
   * Unlock for this tab: open life.html#edit once, or press Ctrl+Shift+E on this page.
   */
  const LIFE_ALBUM_ADMIN_SECRET = "edit_album";

  const STORAGE_KEY = "portfolioLifeAlbum_v1";
  const EDIT_SESSION_KEY = "life_album_edit_session";

  const DEFAULT_ITEMS = [
    { src: "photos/googlevisit.png", caption: "A snap from Google visit, Spring 2025.", alt: "Visiting Google in Spring 2025" },
    { src: "photos/friends_2.png", caption: "Me and friends at Canyon Lake, Winter 2024.", alt: "Friends at Canyon Lake in Winter 2024" },
    { src: "photos/maitidevi.png", caption: "Matidevi Temple, Kathmandu, 2023.", alt: "Matidevi Temple in Kathmandu" },
    { src: "photos/mtbonnel.png", caption: "Mt. Bonnel, Austin, Spring 2024.", alt: "View from Mt. Bonnell in Austin" },
    { src: "photos/friends_3.png", caption: "Galveston Beach, Fall 2024.", alt: "Friends at Galveston Beach in Fall 2024" },
    { src: "photos/pashupati.png", caption: "Pashupati Temple, Kathmandu, 2023.", alt: "Pashupati Temple in Kathmandu" },
    { src: "photos/sanmarcosriver.png", caption: "San Marcos River, Winter 2023.", alt: "San Marcos River in Winter 2023" },
    { src: "photos/snow.png", caption: "My first snowfall experience, Snocalypse, San Marcos, Winter 2024.", alt: "Snowfall experience in San Marcos Winter 2024" },
    { src: "photos/inspiration.png", caption: "Roy F. Mitte, San Marcos, Summer 2025.", alt: "Roy F. Mitte building in Summer 2025" },
    { src: "photos/piano.png", caption: "Me showing off like I know playing piano, San Marcos, Spring 2024.", alt: "Playing piano in Spring 2024" },
    { src: "photos/plane_picture.png", caption: "My Leap of Faith, Winter 2023, Middle of Nowhere.", alt: "On a plane during Winter 2023" },
    { src: "photos/blackboard.png", caption: "Stopwatch Project.", alt: "Stopwatch project on blackboard" },
  ];

  function uid() {
    return crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2);
  }

  function isEditMode() {
    return sessionStorage.getItem(EDIT_SESSION_KEY) === "1";
  }

  function setEditMode(on) {
    if (on) sessionStorage.setItem(EDIT_SESSION_KEY, "1");
    else sessionStorage.removeItem(EDIT_SESSION_KEY);
  }

  function syncAdminPanel() {
    const panel = document.getElementById("album-admin-panel");
    if (!panel) return;
    if (isEditMode()) {
      panel.hidden = false;
      panel.classList.remove("album-admin--hidden");
    } else {
      panel.hidden = true;
      panel.classList.add("album-admin--hidden");
    }
  }

  function tryUnlock() {
    if (isEditMode()) return true;
    if (LIFE_ALBUM_ADMIN_SECRET === "CHANGE_ME_TO_YOUR_SECRET_PHRASE") {
      alert("Set LIFE_ALBUM_ADMIN_SECRET in life.js to your own passphrase before using the editor.");
      return false;
    }
    const phrase = window.prompt("Album editor passphrase:");
    if (phrase === null) return false;
    if (phrase !== LIFE_ALBUM_ADMIN_SECRET) {
      alert("Incorrect passphrase.");
      return false;
    }
    setEditMode(true);
    syncAdminPanel();
    render();
    return true;
  }

  function lockEditor() {
    setEditMode(false);
    syncAdminPanel();
    render();
  }

  function defaultAlbum() {
    return DEFAULT_ITEMS.map((item, i) => ({
      id: "def-" + i,
      src: item.src,
      caption: item.caption,
      alt: item.alt,
    }));
  }

  function loadAlbum() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultAlbum();
      const data = JSON.parse(raw);
      if (!data || !Array.isArray(data.items) || data.items.length === 0) return defaultAlbum();
      return data.items.map((it) => ({
        id: it.id || uid(),
        src: it.src,
        caption: it.caption || "",
        alt: it.alt || "",
      }));
    } catch {
      return defaultAlbum();
    }
  }

  function saveAlbum(items) {
    if (!isEditMode()) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, items }));
  }

  function render() {
    const root = document.getElementById("life-album");
    if (!root) return;
    const items = loadAlbum();
    const editable = isEditMode();
    root.innerHTML = "";

    items.forEach((item) => {
      const card = document.createElement("div");
      card.className = "photos";
      card.dataset.id = item.id;

      const img = document.createElement("img");
      img.src = item.src;
      img.alt = item.alt || item.caption || "Album photo";

      const cap = document.createElement("p");
      cap.className = "album-caption";
      cap.textContent = item.caption;

      card.append(img, cap);

      if (editable) {
        const actions = document.createElement("div");
        actions.className = "album-card-actions";

        const editBtn = document.createElement("button");
        editBtn.type = "button";
        editBtn.textContent = "Edit caption";
        editBtn.addEventListener("click", () => startEdit(card, item.id));

        const delBtn = document.createElement("button");
        delBtn.type = "button";
        delBtn.textContent = "Remove";
        delBtn.classList.add("danger");
        delBtn.addEventListener("click", () => removeItem(item.id));

        actions.append(editBtn, delBtn);
        card.append(actions);
      }

      root.appendChild(card);
    });
  }

  function startEdit(card, id) {
    if (!isEditMode()) return;
    const cap = card.querySelector(".album-caption");
    const actions = card.querySelector(".album-card-actions");
    if (!cap || cap.querySelector("textarea")) return;

    const items = loadAlbum();
    const item = items.find((i) => i.id === id);
    if (!item) return;

    const ta = document.createElement("textarea");
    ta.className = "album-caption-edit";
    ta.value = item.caption;
    cap.replaceWith(ta);

    const wrap = document.createElement("div");
    wrap.className = "album-card-actions";

    const save = document.createElement("button");
    save.type = "button";
    save.textContent = "Save";
    save.addEventListener("click", () => {
      item.caption = ta.value.trim();
      item.alt = item.caption.slice(0, 120) || "Album photo";
      const idx = items.findIndex((i) => i.id === id);
      if (idx !== -1) items[idx] = item;
      saveAlbum(items);
      render();
    });

    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.textContent = "Cancel";
    cancel.addEventListener("click", () => render());

    wrap.append(save, cancel);
    actions.replaceWith(wrap);
  }

  function removeItem(id) {
    if (!isEditMode()) return;
    if (!confirm("Remove this photo from the album?")) return;
    const items = loadAlbum().filter((i) => i.id !== id);
    saveAlbum(items);
    render();
  }

  function addFiles(fileList) {
    if (!isEditMode()) return;
    const files = Array.from(fileList || []).filter((f) => f.type.startsWith("image/"));
    if (!files.length) return;

    const items = loadAlbum();
    let pending = files.length;

    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        items.push({
          id: uid(),
          src: reader.result,
          caption: file.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " "),
          alt: file.name,
        });
        pending -= 1;
        if (pending === 0) {
          saveAlbum(items);
          render();
        }
      };
      reader.onerror = () => {
        pending -= 1;
        if (pending === 0) {
          saveAlbum(items);
          render();
        }
      };
      reader.readAsDataURL(file);
    });
  }

  function restoreDefaults() {
    if (!isEditMode()) return;
    if (!confirm("Reset album to the original site photos? Your changes will be lost.")) return;
    localStorage.removeItem(STORAGE_KEY);
    render();
  }

  function exportJson() {
    if (!isEditMode()) return;
    const blob = new Blob([JSON.stringify({ version: 1, items: loadAlbum() }, null, 2)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "life-album-backup.json";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function importJson(file) {
    if (!isEditMode()) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!data.items || !Array.isArray(data.items)) throw new Error("Invalid file");
        const items = data.items.map((it) => ({
          id: it.id || uid(),
          src: it.src,
          caption: it.caption || "",
          alt: it.alt || "",
        }));
        saveAlbum(items);
        render();
      } catch {
        alert("Could not import that file. Use a backup exported from this page.");
      }
    };
    reader.readAsText(file);
  }

  function maybeOpenFromHash() {
    if (location.hash !== "#edit") return;
    history.replaceState(null, "", location.pathname + location.search);
    tryUnlock();
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (LIFE_ALBUM_ADMIN_SECRET === "CHANGE_ME_TO_YOUR_SECRET_PHRASE") {
      console.warn(
        "[Life album] Set LIFE_ALBUM_ADMIN_SECRET in life.js, then unlock with life.html#edit or Ctrl+Shift+E."
      );
    }

    syncAdminPanel();
    render();
    maybeOpenFromHash();

    document.addEventListener("keydown", (e) => {
      if (e.ctrlKey && e.shiftKey && (e.key === "e" || e.key === "E")) {
        e.preventDefault();
        if (isEditMode()) lockEditor();
        else tryUnlock();
      }
    });

    window.addEventListener("hashchange", () => {
      if (location.hash === "#edit") {
        history.replaceState(null, "", location.pathname + location.search);
        tryUnlock();
      }
    });

    const fileInput = document.getElementById("album-file-input");
    if (fileInput) {
      fileInput.addEventListener("change", () => {
        addFiles(fileInput.files);
        fileInput.value = "";
      });
    }

    const restoreBtn = document.getElementById("album-restore-defaults");
    if (restoreBtn) restoreBtn.addEventListener("click", restoreDefaults);

    const exportBtn = document.getElementById("album-export");
    if (exportBtn) exportBtn.addEventListener("click", exportJson);

    const importInput = document.getElementById("album-import-input");
    if (importInput) {
      importInput.addEventListener("change", () => {
        const f = importInput.files && importInput.files[0];
        if (f) importJson(f);
        importInput.value = "";
      });
    }

    const lockBtn = document.getElementById("album-lock-editor");
    if (lockBtn) lockBtn.addEventListener("click", () => lockEditor());
  });
})();
