(function () {
  /**
   * Owner-only album editor (static GitHub Pages site):
   * - Album data lives in photos/album.json (loaded by everyone).
   * - Uploads commit image files under photos/ via the GitHub Contents API,
   *   then update photos/album.json in the same repo/branch.
   *
   * Unlock: life.html#edit or Ctrl+Shift+E, then enter the passphrase and a
   * GitHub personal access token with Contents: Read and write on this repo.
   * The token is kept in sessionStorage for this tab only (cleared on lock).
   *
   * This is not server-grade security—anyone who knows the passphrase can still
   * be prompted for a token; protect your PAT and do not commit it.
   */
  const LIFE_ALBUM_ADMIN_SECRET = "CHANGE_ME_TO_YOUR_SECRET_PHRASE";

  const GITHUB = {
    owner: "ShreejalBhattarai",
    repo: "PortfolioWebsite",
    /** Commits land on this branch (match the branch you use for Pages / PRs). */
    branch: "life-album-github-uploads",
    albumPath: "photos/album.json",
  };

  const EDIT_SESSION_KEY = "life_album_edit_session";
  const GITHUB_TOKEN_KEY = "life_album_github_token";
  const ALBUM_URL = "photos/album.json";
  const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

  /** Protected site assets — never delete these from the repo via the editor. */
  const PROTECTED_PATHS = new Set([
    "photos/logo.png",
    "photos/cover.jpg",
    "photos/background.jpg",
    "photos/txst.png",
    "photos/album.json",
  ]);

  let albumCache = [];
  let busy = false;

  function uid() {
    return crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2);
  }

  function isEditMode() {
    return sessionStorage.getItem(EDIT_SESSION_KEY) === "1" && !!sessionStorage.getItem(GITHUB_TOKEN_KEY);
  }

  function setEditMode(on, token) {
    if (on) {
      sessionStorage.setItem(EDIT_SESSION_KEY, "1");
      if (token) sessionStorage.setItem(GITHUB_TOKEN_KEY, token);
    } else {
      sessionStorage.removeItem(EDIT_SESSION_KEY);
      sessionStorage.removeItem(GITHUB_TOKEN_KEY);
    }
  }

  function getToken() {
    return sessionStorage.getItem(GITHUB_TOKEN_KEY) || "";
  }

  function setStatus(message, isError) {
    const el = document.getElementById("album-admin-status");
    if (!el) return;
    el.textContent = message || "";
    el.classList.toggle("is-error", !!isError);
  }

  function setBusy(on, message) {
    busy = on;
    const panel = document.getElementById("album-admin-panel");
    if (panel) panel.classList.toggle("is-busy", on);
    const fileInput = document.getElementById("album-file-input");
    if (fileInput) fileInput.disabled = on;
    document.querySelectorAll(".album-admin-actions button, .album-admin-actions label").forEach((el) => {
      if (el.tagName === "BUTTON") el.disabled = on;
      else el.classList.toggle("is-disabled", on);
    });
    if (message !== undefined) setStatus(message, false);
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

  function normalizeItems(items) {
    if (!Array.isArray(items)) return [];
    return items.map((it) => ({
      id: it.id || uid(),
      src: it.src,
      caption: it.caption || "",
      alt: it.alt || "",
    }));
  }

  async function fetchAlbumFromSite() {
    const res = await fetch(ALBUM_URL + "?t=" + Date.now(), { cache: "no-store" });
    if (!res.ok) throw new Error("Could not load " + ALBUM_URL);
    const data = await res.json();
    return normalizeItems(data.items);
  }

  async function refreshAlbum() {
    albumCache = await fetchAlbumFromSite();
    return albumCache;
  }

  function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
  }

  async function githubApi(path, options) {
    const token = getToken();
    if (!token) throw new Error("Missing GitHub token. Unlock the editor again.");
    const res = await fetch("https://api.github.com" + path, {
      ...options,
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: "Bearer " + token,
        "X-GitHub-Api-Version": "2022-11-28",
        ...(options && options.body ? { "Content-Type": "application/json" } : {}),
        ...((options && options.headers) || {}),
      },
    });
    const text = await res.text();
    let body = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = { message: text };
    }
    if (!res.ok) {
      const msg = (body && body.message) || res.statusText || "GitHub API error";
      throw new Error(msg);
    }
    return body;
  }

  async function getRepoFile(path) {
    const q = "?ref=" + encodeURIComponent(GITHUB.branch);
    return githubApi(
      "/repos/" + GITHUB.owner + "/" + GITHUB.repo + "/contents/" + path + q,
      { method: "GET" }
    );
  }

  async function putRepoFile(path, contentBase64, message, sha) {
    const payload = {
      message: message,
      content: contentBase64,
      branch: GITHUB.branch,
    };
    if (sha) payload.sha = sha;
    return githubApi(
      "/repos/" + GITHUB.owner + "/" + GITHUB.repo + "/contents/" + path,
      { method: "PUT", body: JSON.stringify(payload) }
    );
  }

  async function deleteRepoFile(path, message, sha) {
    return githubApi(
      "/repos/" + GITHUB.owner + "/" + GITHUB.repo + "/contents/" + path,
      {
        method: "DELETE",
        body: JSON.stringify({
          message: message,
          sha: sha,
          branch: GITHUB.branch,
        }),
      }
    );
  }

  async function commitAlbum(items, message) {
    const album = { version: 1, items: normalizeItems(items) };
    const json = JSON.stringify(album, null, 2) + "\n";
    const content = btoa(unescape(encodeURIComponent(json)));
    let sha;
    try {
      const existing = await getRepoFile(GITHUB.albumPath);
      sha = existing.sha;
    } catch {
      sha = undefined;
    }
    await putRepoFile(GITHUB.albumPath, content, message, sha);
    albumCache = album.items;
  }

  function safeImageFilename(file) {
    const extMatch = /\.([a-z0-9]+)$/i.exec(file.name || "");
    let ext = extMatch ? extMatch[1].toLowerCase() : "";
    if (!ext) {
      if (file.type === "image/jpeg") ext = "jpg";
      else if (file.type === "image/png") ext = "png";
      else if (file.type === "image/webp") ext = "webp";
      else if (file.type === "image/gif") ext = "gif";
      else ext = "png";
    }
    const base = (file.name || "photo")
      .replace(/\.[^.]+$/, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "photo";
    return "photos/life-" + Date.now() + "-" + base + "." + ext;
  }

  async function verifyToken() {
    await githubApi("/repos/" + GITHUB.owner + "/" + GITHUB.repo, { method: "GET" });
  }

  async function tryUnlock() {
    if (isEditMode()) {
      syncAdminPanel();
      render();
      return true;
    }
    if (LIFE_ALBUM_ADMIN_SECRET === "CHANGE_ME_TO_YOUR_SECRET_PHRASE") {
      alert("Set LIFE_ALBUM_ADMIN_SECRET in life.js before using the editor.");
      return false;
    }
    const phrase = window.prompt("Album editor passphrase:");
    if (phrase === null) return false;
    if (phrase !== LIFE_ALBUM_ADMIN_SECRET) {
      alert("Incorrect passphrase.");
      return false;
    }
    const token = window.prompt(
      "GitHub personal access token (Contents: Read and write).\n" +
        "Commits go to " + GITHUB.owner + "/" + GITHUB.repo + " @" + GITHUB.branch + ".\n" +
        "Token stays in this tab only until you lock the editor."
    );
    if (token === null) return false;
    const trimmed = token.trim();
    if (!trimmed) {
      alert("A GitHub token is required to write photos into the repository.");
      return false;
    }
    try {
      setStatus("Checking GitHub access…");
      sessionStorage.setItem(GITHUB_TOKEN_KEY, trimmed);
      await verifyToken();
    } catch (err) {
      sessionStorage.removeItem(GITHUB_TOKEN_KEY);
      setStatus("");
      alert("GitHub token check failed: " + (err && err.message ? err.message : err));
      return false;
    }
    setEditMode(true, trimmed);
    syncAdminPanel();
    setStatus("Editor unlocked. Uploads commit to photos/ on " + GITHUB.branch + ".");
    render();
    return true;
  }

  function lockEditor() {
    setEditMode(false);
    syncAdminPanel();
    setStatus("");
    render();
  }

  function render() {
    const root = document.getElementById("life-album");
    if (!root) return;
    const items = albumCache;
    const editable = isEditMode();
    root.innerHTML = "";

    if (!items.length) {
      const empty = document.createElement("p");
      empty.className = "album-empty";
      empty.textContent = "No photos in the album yet.";
      root.appendChild(empty);
      return;
    }

    items.forEach((item) => {
      const card = document.createElement("div");
      card.className = "photos";
      card.dataset.id = item.id;

      const img = document.createElement("img");
      img.src = item.src;
      img.alt = item.alt || item.caption || "Album photo";
      img.loading = "lazy";

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
        editBtn.disabled = busy;
        editBtn.addEventListener("click", () => startEdit(card, item.id));

        const delBtn = document.createElement("button");
        delBtn.type = "button";
        delBtn.textContent = "Remove";
        delBtn.classList.add("danger");
        delBtn.disabled = busy;
        delBtn.addEventListener("click", () => removeItem(item.id));

        actions.append(editBtn, delBtn);
        card.append(actions);
      }

      root.appendChild(card);
    });
  }

  function startEdit(card, id) {
    if (!isEditMode() || busy) return;
    const cap = card.querySelector(".album-caption");
    const actions = card.querySelector(".album-card-actions");
    if (!cap || cap.querySelector("textarea")) return;

    const item = albumCache.find((i) => i.id === id);
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
    save.addEventListener("click", async () => {
      if (busy) return;
      const next = albumCache.map((it) =>
        it.id === id
          ? {
              ...it,
              caption: ta.value.trim(),
              alt: ta.value.trim().slice(0, 120) || "Album photo",
            }
          : it
      );
      try {
        setBusy(true, "Saving caption to photos/album.json…");
        await commitAlbum(next, "Update life album caption");
        setStatus("Caption saved to the repository.");
        render();
      } catch (err) {
        setStatus("Save failed: " + (err && err.message ? err.message : err), true);
        alert("Could not save caption: " + (err && err.message ? err.message : err));
      } finally {
        setBusy(false);
      }
    });

    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.textContent = "Cancel";
    cancel.addEventListener("click", () => render());

    wrap.append(save, cancel);
    actions.replaceWith(wrap);
  }

  async function removeItem(id) {
    if (!isEditMode() || busy) return;
    if (!confirm("Remove this photo from the album? The image file will be deleted from the repo if it is under photos/ (except protected site assets).")) {
      return;
    }
    const item = albumCache.find((i) => i.id === id);
    if (!item) return;
    const next = albumCache.filter((i) => i.id !== id);

    try {
      setBusy(true, "Updating album in the repository…");
      await commitAlbum(next, "Remove photo from life album");

      if (item.src && item.src.indexOf("photos/") === 0 && !PROTECTED_PATHS.has(item.src)) {
        try {
          setStatus("Deleting " + item.src + " from the repository…");
          const file = await getRepoFile(item.src);
          await deleteRepoFile(item.src, "Delete life album photo " + item.src, file.sha);
        } catch (delErr) {
          console.warn("Album updated but file delete skipped:", delErr);
          setStatus(
            "Album updated. File delete skipped: " +
              (delErr && delErr.message ? delErr.message : delErr),
            true
          );
          render();
          return;
        }
      }

      setStatus("Photo removed from the repository.");
      render();
    } catch (err) {
      setStatus("Remove failed: " + (err && err.message ? err.message : err), true);
      alert("Could not remove photo: " + (err && err.message ? err.message : err));
    } finally {
      setBusy(false);
    }
  }

  async function addFiles(fileList) {
    if (!isEditMode() || busy) return;
    const files = Array.from(fileList || []).filter((f) => f.type.startsWith("image/"));
    if (!files.length) return;

    const tooBig = files.filter((f) => f.size > MAX_UPLOAD_BYTES);
    if (tooBig.length) {
      alert(
        "These files are larger than 8 MB and were skipped:\n" +
          tooBig.map((f) => f.name).join("\n") +
          "\n\nCompress them first, then try again."
      );
    }
    const usable = files.filter((f) => f.size <= MAX_UPLOAD_BYTES);
    if (!usable.length) return;

    try {
      setBusy(true, "Uploading to photos/…");
      const items = albumCache.slice();

      for (let i = 0; i < usable.length; i++) {
        const file = usable[i];
        const path = safeImageFilename(file);
        setStatus("Uploading " + (i + 1) + "/" + usable.length + ": " + path);

        const buffer = await file.arrayBuffer();
        const content = arrayBufferToBase64(buffer);
        await putRepoFile(path, content, "Add life album photo " + path);

        const caption = file.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ").trim();
        items.push({
          id: uid(),
          src: path,
          caption: caption,
          alt: caption.slice(0, 120) || "Album photo",
        });
      }

      setStatus("Updating photos/album.json…");
      await commitAlbum(items, "Update life album after photo upload");
      setStatus("Uploaded " + usable.length + " photo(s) to the repository on " + GITHUB.branch + ".");
      render();
    } catch (err) {
      setStatus("Upload failed: " + (err && err.message ? err.message : err), true);
      alert("Upload failed: " + (err && err.message ? err.message : err));
      try {
        await refreshAlbum();
        render();
      } catch (_) { /* ignore */ }
    } finally {
      setBusy(false);
    }
  }

  async function restoreDefaults() {
    if (!isEditMode() || busy) return;
    if (!confirm("Reset photos/album.json to the built-in default list? Image files already in the repo will not be deleted.")) {
      return;
    }
    const defaults = [
      { id: "def-0", src: "photos/googlevisit.png", caption: "A snap from Google visit, Spring 2025.", alt: "Visiting Google in Spring 2025" },
      { id: "def-1", src: "photos/friends_2.png", caption: "Me and friends at Canyon Lake, Winter 2024.", alt: "Friends at Canyon Lake in Winter 2024" },
      { id: "def-2", src: "photos/maitidevi.png", caption: "Matidevi Temple, Kathmandu, 2023.", alt: "Matidevi Temple in Kathmandu" },
      { id: "def-3", src: "photos/mtbonnel.png", caption: "Mt. Bonnel, Austin, Spring 2024.", alt: "View from Mt. Bonnell in Austin" },
      { id: "def-4", src: "photos/friends_3.png", caption: "Galveston Beach, Fall 2024.", alt: "Friends at Galveston Beach in Fall 2024" },
      { id: "def-5", src: "photos/pashupati.png", caption: "Pashupati Temple, Kathmandu, 2023.", alt: "Pashupati Temple in Kathmandu" },
      { id: "def-6", src: "photos/sanmarcosriver.png", caption: "San Marcos River, Winter 2023.", alt: "San Marcos River in Winter 2023" },
      { id: "def-7", src: "photos/snow.png", caption: "My first snowfall experience, Snocalypse, San Marcos, Winter 2024.", alt: "Snowfall experience in San Marcos Winter 2024" },
      { id: "def-8", src: "photos/inspiration.png", caption: "Roy F. Mitte, San Marcos, Summer 2025.", alt: "Roy F. Mitte building in Summer 2025" },
      { id: "def-9", src: "photos/piano.png", caption: "Me showing off like I know playing piano, San Marcos, Spring 2024.", alt: "Playing piano in Spring 2024" },
      { id: "def-10", src: "photos/plane_picture.png", caption: "My Leap of Faith, Winter 2023, Middle of Nowhere.", alt: "On a plane during Winter 2023" },
      { id: "def-11", src: "photos/blackboard.png", caption: "Stopwatch Project.", alt: "Stopwatch project on blackboard" },
    ];
    try {
      setBusy(true, "Resetting photos/album.json…");
      await commitAlbum(defaults, "Reset life album to defaults");
      setStatus("Album reset to defaults in the repository.");
      render();
    } catch (err) {
      setStatus("Reset failed: " + (err && err.message ? err.message : err), true);
      alert("Reset failed: " + (err && err.message ? err.message : err));
    } finally {
      setBusy(false);
    }
  }

  function maybeOpenFromHash() {
    if (location.hash !== "#edit") return;
    history.replaceState(null, "", location.pathname + location.search);
    tryUnlock();
  }

  document.addEventListener("DOMContentLoaded", async () => {
    syncAdminPanel();
    setStatus("");

    try {
      await refreshAlbum();
      render();
    } catch (err) {
      const root = document.getElementById("life-album");
      if (root) {
        root.innerHTML =
          "<p class=\"album-empty\">Could not load the photo album. Serve this site over HTTP(S) so photos/album.json can be fetched.</p>";
      }
      console.error(err);
    }

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
    if (exportBtn) {
      exportBtn.addEventListener("click", () => {
        const blob = new Blob([JSON.stringify({ version: 1, items: albumCache }, null, 2) + "\n"], {
          type: "application/json",
        });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "album.json";
        a.click();
        URL.revokeObjectURL(a.href);
      });
    }

    const lockBtn = document.getElementById("album-lock-editor");
    if (lockBtn) lockBtn.addEventListener("click", () => lockEditor());

    try {
      localStorage.removeItem("portfolioLifeAlbum_v1");
    } catch (_) { /* ignore */ }
  });
})();
