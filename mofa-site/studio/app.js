(function () {
  const sessionStorageKey = 'mofa-site-studio-session-id';
  const commandAliases = {
    learning: 'learning',
    lesson: 'learning',
    course: 'learning',
    math: 'learning',
    physics: 'learning',
    astro: 'astro',
    docs: 'astro',
    documentation: 'astro',
    guide: 'astro',
    next: 'nextjs',
    nextjs: 'nextjs',
    app: 'nextjs',
    product: 'nextjs',
    event: 'nextjs',
    react: 'react',
    vite: 'react',
    prototype: 'react',
    tool: 'react',
  };

  const $ = (id) => document.getElementById(id);
  const els = {
    launcher: $('launcher'),
    launcherCards: $('launcher-cards'),
    launchForm: $('launch-form'),
    sessionCommand: $('session-command'),
    siteNameInput: $('site-name-input'),
    siteDescriptionInput: $('site-description-input'),
    launchSession: $('launch-session'),
    reuseSession: $('reuse-session'),
    launcherPreview: $('launcher-preview'),
    studioShell: $('studio-shell'),
    newSession: $('new-session'),
    sessionTitle: $('session-title'),
    sessionTemplate: $('session-template'),
    sessionKind: $('session-kind'),
    sessionRuntime: $('session-runtime'),
    sessionSummary: $('session-summary'),
    sessionPreviewLink: $('session-preview-link'),
    sessionRoot: $('session-root'),
    chatLog: $('chat-log'),
    chatForm: $('chat-form'),
    chatInput: $('chat-input'),
    sendChat: $('send-chat'),
    pageStrip: $('page-strip'),
    siteFrame: $('site-frame'),
    previewUrl: $('preview-url'),
    refreshPreview: $('refresh-preview'),
    refreshFiles: $('refresh-files'),
    projectRoot: $('project-root'),
    fileTree: $('file-tree'),
    viewerPath: $('viewer-path'),
    viewerKind: $('viewer-kind'),
    fileContent: $('file-content'),
  };

  const state = {
    meta: null,
    session: null,
    fileTree: [],
    selectedFile: '',
    selectedFileContent: '',
    selectedFileKind: 'viewer',
    activePageSlug: '',
    pollTimer: null,
    busy: false,
  };

  function apiUrl(path) {
    return new URL(path, new URL('./api/', window.location.href)).toString();
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/"/g, '&quot;');
  }

  function formatRole(role) {
    return role === 'assistant' ? 'Builder' : 'You';
  }

  function formatTime(timestamp) {
    try {
      return new Date(timestamp).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  }

  function parseSessionCommand(command) {
    const normalized = (command || '').trim().toLowerCase().replace(/\s+/g, ' ');
    if (!normalized) return 'learning';
    const token = normalized.replace(/^\/new site\s+/, '').trim();
    return commandAliases[token] || 'learning';
  }

  function templateViewerKind(filePath) {
    const ext = (filePath.split('.').pop() || '').toLowerCase();
    if (['js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs'].includes(ext)) return 'javascript';
    if (['css'].includes(ext)) return 'css';
    if (['html', 'astro'].includes(ext)) return 'markup';
    if (['md', 'qmd'].includes(ext)) return 'markdown';
    if (['json', 'yml', 'yaml'].includes(ext)) return ext;
    if (['sh'].includes(ext)) return 'shell';
    return 'text';
  }

  async function request(path, options) {
    const response = await fetch(path, options);
    const text = await response.text();
    let payload = null;

    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = text;
    }

    if (!response.ok) {
      const message =
        payload && typeof payload === 'object' && payload.error ? payload.error : response.statusText;
      throw new Error(message);
    }

    return payload;
  }

  function setBusy(active, label) {
    state.busy = active;
    els.launchSession.disabled = active;
    els.sendChat.disabled = active;
    if (label) {
      els.launchSession.textContent = active ? label : 'Build session';
    } else if (!active) {
      els.launchSession.textContent = 'Build session';
    }
  }

  function previewTextForPreset(presetKey) {
    if (!state.meta) return '';
    const preset = state.meta.presets[presetKey];
    if (!preset) return '';
    return [
      `Command: ${preset.command}`,
      `Template: ${preset.template}`,
      `Best for: ${preset.siteKind}`,
      `Reference pattern: ${preset.reference}`,
      `Default site: ${preset.siteName}`,
      '',
      `Backend action: scaffold ${preset.template}, write session files, expose /sites/${preset.siteSlugHint || 'your-site'}/ preview, and mount the generated tree into the file viewer.`,
    ].join('\n');
  }

  function renderLauncherCards() {
    const presets = Object.entries(state.meta.presets);
    const activePreset = parseSessionCommand(els.sessionCommand.value);
    els.launcherCards.innerHTML = presets
      .map(([key, preset]) => {
        const active = key === activePreset ? ' active' : '';
        return `
          <button class="launch-card${active}" data-preset="${escapeAttr(key)}" type="button">
            <p class="eyebrow">${escapeHtml(preset.badge)}</p>
            <h2>${escapeHtml(preset.command)}</h2>
            <p>${escapeHtml(preset.description)}</p>
            <div class="launch-badges">
              <span class="badge">${escapeHtml(preset.template)}</span>
              <span class="badge">${escapeHtml(preset.referenceLabel)}</span>
            </div>
          </button>
        `;
      })
      .join('');
    els.launcherPreview.textContent = previewTextForPreset(activePreset);
  }

  function setLauncherDefaults(presetKey, replaceEmptyOnly) {
    const preset = state.meta.presets[presetKey];
    if (!preset) return;
    els.sessionCommand.value = preset.command;

    if (!replaceEmptyOnly || !els.siteNameInput.value.trim()) {
      els.siteNameInput.value = preset.siteName;
    }

    if (!replaceEmptyOnly || !els.siteDescriptionInput.value.trim()) {
      els.siteDescriptionInput.value = preset.description;
    }

    renderLauncherCards();
  }

  function showLauncher() {
    document.body.classList.add('launcher-open');
    els.launcher.hidden = false;
  }

  function hideLauncher() {
    document.body.classList.remove('launcher-open');
    els.launcher.hidden = true;
  }

  function previewUrlFor(pageSlug) {
    if (!state.session) return '';
    const suffix = pageSlug && pageSlug !== state.session.homePageSlug ? `${pageSlug}/` : '';
    return `${state.session.previewUrl}${suffix}`;
  }

  function renderChat() {
    els.chatLog.innerHTML = state.session.chat
      .map(
        (message) => `
          <article class="chat-message ${escapeAttr(message.role)}">
            <div class="chat-message-head">
              <span>${escapeHtml(formatRole(message.role))}</span>
              <span>${escapeHtml(formatTime(message.timestamp))}</span>
            </div>
            <p>${escapeHtml(message.content)}</p>
          </article>
        `,
      )
      .join('');
    els.chatLog.scrollTop = els.chatLog.scrollHeight;
  }

  function renderPageStrip() {
    els.pageStrip.innerHTML = state.session.pages
      .map((page) => {
        const active = page.slug === state.activePageSlug ? ' active' : '';
        return `
          <button class="page-chip${active}" data-page-slug="${escapeAttr(page.slug)}" type="button">
            <strong>${escapeHtml(page.title)}</strong>
            <span>${escapeHtml(page.goal)}</span>
          </button>
        `;
      })
      .join('');
  }

  function renderTreeNodes(nodes) {
    return nodes
      .map((node) => {
        if (node.type === 'directory') {
          return `
            <div class="tree-node tree-folder">
              <details open>
                <summary>${escapeHtml(node.name)}</summary>
                <div class="tree-children">${renderTreeNodes(node.children || [])}</div>
              </details>
            </div>
          `;
        }

        const active = node.path === state.selectedFile ? ' active' : '';
        return `
          <div class="tree-node">
            <button class="tree-file${active}" data-path="${escapeAttr(node.path)}" type="button">
              ${escapeHtml(node.name)}
            </button>
          </div>
        `;
      })
      .join('');
  }

  function renderFileTree() {
    els.fileTree.innerHTML = state.fileTree.length
      ? renderTreeNodes(state.fileTree)
      : '<p class="muted">No files yet.</p>';
  }

  function renderViewer() {
    els.viewerPath.textContent = state.selectedFile || 'Select a file';
    els.viewerKind.textContent = state.selectedFileKind;
    els.fileContent.textContent = state.selectedFileContent || 'Choose a file from the tree.';
  }

  function renderSession() {
    if (!state.session) return;

    document.documentElement.style.setProperty('--accent', state.session.accent);
    els.studioShell.hidden = false;
    hideLauncher();

    els.sessionTitle.textContent = state.session.siteName;
    els.sessionTemplate.textContent = state.session.template;
    els.sessionKind.textContent = state.session.siteKind;
    els.sessionRuntime.textContent = state.session.id;
    els.sessionSummary.textContent = state.session.description;
    els.sessionPreviewLink.href = state.session.previewUrl;
    els.sessionPreviewLink.textContent = state.session.previewUrl;
    els.sessionRoot.textContent = state.session.projectRoot;
    els.projectRoot.textContent = state.session.projectRoot;
    els.previewUrl.textContent = previewUrlFor(state.activePageSlug);

    renderChat();
    renderPageStrip();
    renderFileTree();
    renderViewer();
    updateFrame();
  }

  function updateFrame() {
    const url = previewUrlFor(state.activePageSlug);
    els.previewUrl.textContent = url || '-';
    if (url) els.siteFrame.src = url;
  }

  async function loadFile(filePath) {
    if (!state.session || !filePath) return;
    const payload = await request(
      `${apiUrl(`sessions/${state.session.id}/file`)}?path=${encodeURIComponent(filePath)}`,
    );
    state.selectedFile = payload.path;
    state.selectedFileKind = templateViewerKind(payload.path);
    state.selectedFileContent = payload.content;
    renderFileTree();
    renderViewer();
  }

  function applySnapshot(snapshot, preserveFile) {
    state.session = snapshot.session;
    state.fileTree = snapshot.tree || [];
    state.activePageSlug =
      state.activePageSlug && snapshot.session.pages.some((page) => page.slug === state.activePageSlug)
        ? state.activePageSlug
        : snapshot.session.homePageSlug;

    const nextFile =
      preserveFile && state.selectedFile
        ? state.selectedFile
        : snapshot.session.defaultFile || '';

    renderSession();

    if (nextFile) {
      loadFile(nextFile).catch((error) => {
        state.selectedFile = '';
        state.selectedFileContent = `Unable to load file.\n\n${error.message}`;
        state.selectedFileKind = 'error';
        renderViewer();
      });
    }

    localStorage.setItem(sessionStorageKey, snapshot.session.id);
  }

  async function refreshSession(preserveFile) {
    if (!state.session) return;
    const snapshot = await request(apiUrl(`sessions/${state.session.id}`));
    applySnapshot(snapshot, preserveFile);
  }

  function startPolling() {
    stopPolling();
    state.pollTimer = window.setInterval(() => {
      refreshSession(true).catch(() => {});
    }, 4000);
  }

  function stopPolling() {
    if (state.pollTimer) {
      window.clearInterval(state.pollTimer);
      state.pollTimer = null;
    }
  }

  async function createSession(event) {
    event.preventDefault();
    if (!state.meta) return;
    setBusy(true, 'Building…');

    try {
      const snapshot = await request(apiUrl('sessions'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command: els.sessionCommand.value,
          siteName: els.siteNameInput.value,
          description: els.siteDescriptionInput.value,
        }),
      });
      applySnapshot(snapshot, false);
      startPolling();
    } catch (error) {
      els.launcherPreview.textContent = `Unable to create session.\n\n${error.message}`;
    } finally {
      setBusy(false);
    }
  }

  async function restoreLastSession() {
    const sessionId = localStorage.getItem(sessionStorageKey);
    if (!sessionId) {
      els.launcherPreview.textContent = 'No saved session id was found in this browser.';
      return;
    }

    try {
      const snapshot = await request(apiUrl(`sessions/${sessionId}`));
      applySnapshot(snapshot, false);
      startPolling();
    } catch (error) {
      els.launcherPreview.textContent = `Unable to restore the last session.\n\n${error.message}`;
      localStorage.removeItem(sessionStorageKey);
    }
  }

  async function sendChatMessage(rawText) {
    const text = rawText.trim();
    if (!text || !state.session) return;
    setBusy(true);

    try {
      const snapshot = await request(apiUrl(`sessions/${state.session.id}/chat`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      els.chatInput.value = '';
      applySnapshot(snapshot, true);
      startPolling();
    } catch (error) {
      state.session.chat.push({
        role: 'assistant',
        content: `Request failed: ${error.message}`,
        timestamp: new Date().toISOString(),
      });
      renderChat();
    } finally {
      setBusy(false);
    }
  }

  function bindEvents() {
    els.launchForm.addEventListener('submit', createSession);
    els.reuseSession.addEventListener('click', restoreLastSession);
    els.newSession.addEventListener('click', showLauncher);
    els.refreshPreview.addEventListener('click', updateFrame);
    els.refreshFiles.addEventListener('click', () => refreshSession(true));

    els.chatForm.addEventListener('submit', (event) => {
      event.preventDefault();
      sendChatMessage(els.chatInput.value);
    });

    els.launcherCards.addEventListener('click', (event) => {
      const button = event.target.closest('[data-preset]');
      if (!button) return;
      setLauncherDefaults(button.dataset.preset, false);
    });

    els.sessionCommand.addEventListener('input', () => {
      const presetKey = parseSessionCommand(els.sessionCommand.value);
      renderLauncherCards();
      const preset = state.meta.presets[presetKey];
      if (!els.siteNameInput.value.trim()) els.siteNameInput.value = preset.siteName;
      if (!els.siteDescriptionInput.value.trim()) els.siteDescriptionInput.value = preset.description;
    });

    document.addEventListener('click', (event) => {
      const chip = event.target.closest('.chip[data-chat]');
      if (chip) {
        els.chatInput.value = chip.dataset.chat;
        els.chatInput.focus();
        return;
      }

      const pageButton = event.target.closest('[data-page-slug]');
      if (pageButton) {
        state.activePageSlug = pageButton.dataset.pageSlug;
        renderPageStrip();
        updateFrame();
        return;
      }

      const fileButton = event.target.closest('[data-path]');
      if (fileButton) {
        loadFile(fileButton.dataset.path).catch((error) => {
          state.selectedFile = fileButton.dataset.path;
          state.selectedFileContent = `Unable to load file.\n\n${error.message}`;
          state.selectedFileKind = 'error';
          renderViewer();
        });
      }
    });
  }

  async function init() {
    state.meta = await request(apiUrl('meta'));
    bindEvents();
    setLauncherDefaults('astro', true);

    const params = new URLSearchParams(window.location.search);
    const preset = params.get('preset');
    const command = params.get('cmd');
    if (preset && state.meta.presets[preset]) {
      setLauncherDefaults(preset, false);
    } else if (command) {
      setLauncherDefaults(parseSessionCommand(command), false);
      els.sessionCommand.value = command;
    }

    renderLauncherCards();
    showLauncher();

    const existingSessionId = localStorage.getItem(sessionStorageKey);
    if (existingSessionId) {
      els.launcherPreview.textContent += '\n\nA previous session id is stored in this browser. Use "Reuse last session" to reopen it.';
    }
  }

  init().catch((error) => {
    els.launcherPreview.textContent = `Studio failed to load.\n\n${error.message}`;
    showLauncher();
  });
})();
