const http = require('node:http');
const crypto = require('node:crypto');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { URL } = require('node:url');

const HOST = process.env.MOFA_SITE_STUDIO_HOST || '127.0.0.1';
const PORT = Number(process.env.MOFA_SITE_STUDIO_PORT || process.env.PORT || 4310);
const STUDIO_DIR = __dirname;
const ROOT_DIR = path.resolve(STUDIO_DIR, '..');
const RUNTIME_ROOT =
  process.env.MOFA_SITE_STUDIO_RUNTIME || path.join(os.tmpdir(), 'mofa-site-studio-runtime');

const sessionsById = new Map();
const sessionIdBySlug = new Map();

const presetDefinitions = {
  learning: {
    command: '/new site learning',
    template: 'quarto-lesson',
    siteKind: 'course',
    siteName: 'Physics Learning Studio',
    description:
      'Lesson-driven math and physics site with chapter pages, diagrams, and explanatory notes.',
    accent: '#2563eb',
    badge: 'Learning',
    reference: '/Users/yuechen/home/sophie/3b1b-calculus',
    referenceLabel: '3b1b-calculus',
    siteSlugHint: 'physics-learning-studio',
    pages: [
      {
        title: 'Course Home',
        slug: 'home',
        goal: 'Frame the course arc and sequence the first chapters.',
        sections: ['Hero', 'Learning path', 'Course logistics'],
      },
      {
        title: 'Lesson 1',
        slug: 'lesson-1',
        goal: 'Introduce the opening concept with a visual explanation and one exercise.',
        sections: ['Video', 'Frames', 'Core idea', 'Interactive', 'Recap'],
      },
      {
        title: 'Lesson 2',
        slug: 'lesson-2',
        goal: 'Extend the concept with a worked example and a practice prompt.',
        sections: ['Hook', 'Example', 'Visual proof', 'Exercise'],
      },
    ],
  },
  astro: {
    command: '/new site astro',
    template: 'astro-site',
    siteKind: 'docs',
    siteName: 'Signal Atlas',
    description:
      'Structured content site for guides, onboarding, changelogs, and reference pages.',
    accent: '#d97706',
    badge: 'Docs',
    reference: '/Users/yuechen/home/origin2025',
    referenceLabel: 'origin2025',
    siteSlugHint: 'signal-atlas',
    pages: [
      {
        title: 'Overview',
        slug: 'overview',
        goal: 'Show the product story, navigation, and first-run guidance.',
        sections: ['Hero', 'Why it exists', 'Quickstart'],
      },
      {
        title: 'Guide',
        slug: 'guide',
        goal: 'Lay out the primary walkthrough and the action sequence for new users.',
        sections: ['Install', 'Workflow', 'Examples'],
      },
      {
        title: 'Reference',
        slug: 'reference',
        goal: 'Hold the stable API, commands, and integration notes.',
        sections: ['Routes', 'Settings', 'Troubleshooting'],
      },
    ],
  },
  nextjs: {
    command: '/new site nextjs',
    template: 'nextjs-app',
    siteKind: 'product',
    siteName: 'Vision Forum',
    description:
      'App-like landing shell for events, products, and structured call-to-action flows.',
    accent: '#0f766e',
    badge: 'App',
    reference: '/Users/yuechen/home/ai-vision-forum-paris-2026',
    referenceLabel: 'ai-vision-forum-paris-2026',
    siteSlugHint: 'vision-forum',
    pages: [
      {
        title: 'Home',
        slug: 'home',
        goal: 'Present the main story, top CTA, and feature grid.',
        sections: ['Hero', 'Program', 'Highlights'],
      },
      {
        title: 'Contact',
        slug: 'contact',
        goal: 'Collect inbound requests, venue info, and partnership details.',
        sections: ['Contact form', 'Location', 'FAQ'],
      },
      {
        title: 'Privacy',
        slug: 'privacy',
        goal: 'Surface policy links and trust language for the site shell.',
        sections: ['Policy', 'Data use', 'Contact'],
      },
    ],
  },
  react: {
    command: '/new site react',
    template: 'react-vite',
    siteKind: 'tool',
    siteName: 'React Lab',
    description: 'Lean React/Vite shell for prototypes, interface experiments, and lightweight tools.',
    accent: '#be123c',
    badge: 'Prototype',
    reference: '/Users/yuechen/home/adora-website',
    referenceLabel: 'adora-website',
    siteSlugHint: 'react-lab',
    pages: [
      {
        title: 'Home',
        slug: 'home',
        goal: 'Anchor the shell with a clear entry point and one primary CTA.',
        sections: ['Header', 'Hero', 'Feature cards'],
      },
      {
        title: 'Workspace',
        slug: 'workspace',
        goal: 'Expose the main interactive surface for the prototype.',
        sections: ['Canvas', 'Controls', 'Status'],
      },
      {
        title: 'Roadmap',
        slug: 'roadmap',
        goal: 'Document what comes next and what is still mocked.',
        sections: ['Scope', 'Milestones', 'Notes'],
      },
    ],
  },
};

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

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

const textExtensions = new Set([
  '.astro',
  '.cjs',
  '.css',
  '.html',
  '.js',
  '.json',
  '.jsx',
  '.md',
  '.mjs',
  '.qmd',
  '.sh',
  '.ts',
  '.tsx',
  '.txt',
  '.yaml',
  '.yml',
]);

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function parseSessionCommand(command) {
  const normalized = String(command || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
  const token = normalized.replace(/^\/new site\s+/, '').trim();
  return commandAliases[token] || 'learning';
}

function defaultFileForTemplate(template) {
  switch (template) {
    case 'astro-site':
      return 'src/pages/index.astro';
    case 'nextjs-app':
      return 'app/page.tsx';
    case 'react-vite':
      return 'src/App.jsx';
    case 'quarto-lesson':
    default:
      return 'index.qmd';
  }
}

function applyPresetToSession(session, presetKey, preserveText) {
  const preset = presetDefinitions[presetKey];
  const previousPreset = session.presetKey ? presetDefinitions[session.presetKey] : null;
  const keepName =
    preserveText &&
    session.siteName &&
    previousPreset &&
    session.siteName !== previousPreset.siteName;
  const keepDescription =
    preserveText &&
    session.description &&
    previousPreset &&
    session.description !== previousPreset.description;

  session.presetKey = presetKey;
  session.command = preset.command;
  session.template = preset.template;
  session.siteKind = preset.siteKind;
  session.accent = preset.accent;
  session.reference = preset.reference;
  session.referenceLabel = preset.referenceLabel;
  session.pages = clone(preset.pages);
  session.homePageSlug = session.pages[0].slug;
  session.defaultFile = defaultFileForTemplate(session.template);

  if (!keepName) session.siteName = preset.siteName;
  if (!keepDescription) session.description = preset.description;
}

function currentOrigin(req) {
  if (process.env.MOFA_SITE_PUBLIC_ORIGIN) return process.env.MOFA_SITE_PUBLIC_ORIGIN;
  const forwardedProto = String(req.headers['x-forwarded-proto'] || 'http').split(',')[0].trim();
  const forwardedHost = String(req.headers['x-forwarded-host'] || req.headers.host || `${HOST}:${PORT}`)
    .split(',')[0]
    .trim();
  return `${forwardedProto}://${forwardedHost}`;
}

function sessionPreviewUrl(session, req) {
  return `${currentOrigin(req)}/sites/${session.siteSlug}/`;
}

function buildOptimizedPrompt(session) {
  return [
    `Template: ${session.template}`,
    `Site kind: ${session.siteKind}`,
    `Site name: ${session.siteName}`,
    `Description: ${session.description}`,
    `Reference pattern: ${session.reference}`,
    `Accent: ${session.accent}`,
    '',
    'Pages:',
    ...session.pages.map((page, index) => {
      return `${index + 1}. ${page.title} (${page.slug}) -> ${page.goal} [${page.sections.join(', ')}]`;
    }),
    '',
    'Studio contract:',
    '- build a starter scaffold first',
    '- keep the file tree inspectable in real time',
    '- keep the preview route stable under /sites/<site-slug>/',
  ].join('\n');
}

async function writeGeneratedArtifacts(session) {
  const contentDir = path.join(session.projectRoot, 'content');
  await fsp.rm(contentDir, { recursive: true, force: true });
  await fsp.mkdir(contentDir, { recursive: true });

  const sessionPayload = {
    id: session.id,
    command: session.command,
    presetKey: session.presetKey,
    template: session.template,
    siteKind: session.siteKind,
    siteName: session.siteName,
    description: session.description,
    accent: session.accent,
    reference: session.reference,
    siteSlug: session.siteSlug,
    pages: session.pages,
  };

  await fsp.writeFile(
    path.join(session.projectRoot, 'mofa-site-session.json'),
    JSON.stringify(sessionPayload, null, 2),
  );

  await fsp.writeFile(
    path.join(session.projectRoot, 'site-plan.json'),
    JSON.stringify(
      {
        generatedAt: session.updatedAt,
        template: session.template,
        siteName: session.siteName,
        pages: session.pages,
      },
      null,
      2,
    ),
  );

  await fsp.writeFile(path.join(session.projectRoot, 'optimized-prompt.md'), buildOptimizedPrompt(session));

  const overview = [
    `# ${session.siteName}`,
    '',
    session.description,
    '',
    `- template: ${session.template}`,
    `- site kind: ${session.siteKind}`,
    `- reference: ${session.reference}`,
    '',
    '## Pages',
    ...session.pages.map((page) => `- ${page.title}: ${page.goal}`),
  ].join('\n');
  await fsp.writeFile(path.join(contentDir, 'overview.md'), overview);

  for (const page of session.pages) {
    const pageDoc = [
      `# ${page.title}`,
      '',
      `Slug: \`${page.slug}\``,
      '',
      `Goal: ${page.goal}`,
      '',
      'Sections:',
      ...page.sections.map((section) => `- ${section}`),
    ].join('\n');
    await fsp.writeFile(path.join(contentDir, `${page.slug}.md`), pageDoc);
  }
}

function runBootstrap(session) {
  const scriptsDir = path.join(ROOT_DIR, 'scripts');
  const siteName = session.siteName;
  const description = session.description;
  let command = null;

  if (session.template === 'quarto-lesson') {
    command = [
      'bash',
      [
        path.join(scriptsDir, 'bootstrap_quarto_lesson.sh'),
        '--out-dir',
        session.projectRoot,
        '--title',
        siteName,
        '--description',
        description,
      ],
    ];
  } else {
    command = [
      'bash',
      [
        path.join(scriptsDir, 'bootstrap_template.sh'),
        '--template',
        session.template,
        '--out-dir',
        session.projectRoot,
        '--site-name',
        siteName,
        '--description',
        description,
        '--accent',
        session.accent,
        '--locale',
        'en',
      ],
    ];
  }

  fs.rmSync(session.projectRoot, { recursive: true, force: true });
  fs.mkdirSync(session.projectRoot, { recursive: true });

  const [bin, args] = command;
  const result = spawnSync(bin, args, {
    cwd: ROOT_DIR,
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    const failure = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
    throw new Error(failure || `bootstrap failed for ${session.template}`);
  }
}

async function scaffoldSession(session) {
  runBootstrap(session);
  await writeGeneratedArtifacts(session);
}

async function saveSession(session) {
  await fsp.mkdir(session.sessionRoot, { recursive: true });
  await fsp.writeFile(
    path.join(session.sessionRoot, 'session.json'),
    JSON.stringify(
      {
        id: session.id,
        sessionRoot: session.sessionRoot,
        projectRoot: session.projectRoot,
        siteSlug: session.siteSlug,
        presetKey: session.presetKey,
        command: session.command,
        template: session.template,
        siteKind: session.siteKind,
        siteName: session.siteName,
        description: session.description,
        accent: session.accent,
        reference: session.reference,
        referenceLabel: session.referenceLabel,
        pages: session.pages,
        homePageSlug: session.homePageSlug,
        defaultFile: session.defaultFile,
        chat: session.chat,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
      },
      null,
      2,
    ),
  );
}

function registerSession(session) {
  sessionsById.set(session.id, session);
  sessionIdBySlug.set(session.siteSlug, session.id);
}

function uniqueSiteSlug(seed) {
  const base = slugify(seed) || 'mofa-site';
  let candidate = base;
  let index = 2;
  while (sessionIdBySlug.has(candidate)) {
    candidate = `${base}-${index}`;
    index += 1;
  }
  return candidate;
}

function serializeSession(session, req) {
  return {
    id: session.id,
    command: session.command,
    template: session.template,
    siteKind: session.siteKind,
    siteName: session.siteName,
    description: session.description,
    accent: session.accent,
    reference: session.reference,
    referenceLabel: session.referenceLabel,
    siteSlug: session.siteSlug,
    previewUrl: sessionPreviewUrl(session, req),
    projectRoot: session.projectRoot,
    homePageSlug: session.homePageSlug,
    defaultFile: session.defaultFile,
    pages: session.pages,
    chat: session.chat,
  };
}

async function listTree(rootDir, nested = '') {
  const absolute = path.join(rootDir, nested);
  const entries = await fsp.readdir(absolute, { withFileTypes: true });
  const filtered = entries
    .filter((entry) => !['.DS_Store', '.git', 'node_modules'].includes(entry.name))
    .sort((left, right) => {
      if (left.isDirectory() && !right.isDirectory()) return -1;
      if (!left.isDirectory() && right.isDirectory()) return 1;
      return left.name.localeCompare(right.name);
    });

  return Promise.all(
    filtered.map(async (entry) => {
      const relative = nested ? path.posix.join(nested, entry.name) : entry.name;
      if (entry.isDirectory()) {
        return {
          type: 'directory',
          name: entry.name,
          path: relative,
          children: await listTree(rootDir, relative),
        };
      }

      return {
        type: 'file',
        name: entry.name,
        path: relative,
      };
    }),
  );
}

async function buildSnapshot(session, req) {
  return {
    session: serializeSession(session, req),
    tree: await listTree(session.projectRoot),
  };
}

function sanitizeUserText(value) {
  return String(value || '')
    .trim()
    .replace(/^["']+|["']+$/g, '');
}

function assistantReply(message) {
  return {
    role: 'assistant',
    content: message,
    timestamp: new Date().toISOString(),
  };
}

function userReply(message) {
  return {
    role: 'user',
    content: message,
    timestamp: new Date().toISOString(),
  };
}

function ensurePageSelection(session) {
  if (!session.pages.length) {
    session.pages = clone(presetDefinitions[session.presetKey].pages);
  }
  session.homePageSlug = session.pages[0].slug;
}

function findPageIndex(session, token) {
  const normalized = slugify(token);
  return session.pages.findIndex((page) => page.slug === normalized || slugify(page.title) === normalized);
}

function applyChatText(session, text) {
  const trimmed = sanitizeUserText(text);
  const lower = trimmed.toLowerCase();
  let rebuild = false;
  let filesOnly = false;
  const notes = [];

  if (lower.startsWith('/new site')) {
    applyPresetToSession(session, parseSessionCommand(trimmed), true);
    rebuild = true;
    notes.push(`Switched the session to ${session.template} and rebuilt the starter scaffold.`);
  }

  const renameMatch =
    trimmed.match(/^(?:rename site to|call(?: the)? site)\s+(.+)$/i) ||
    trimmed.match(/^site name:\s+(.+)$/i);
  if (renameMatch) {
    session.siteName = sanitizeUserText(renameMatch[1]);
    rebuild = true;
    notes.push(`Renamed the site to "${session.siteName}". The preview title and scaffold files were rebuilt.`);
  }

  const descriptionMatch =
    trimmed.match(/^(?:set description to|description:)\s+(.+)$/i) ||
    trimmed.match(/^(?:make it about|focus on)\s+(.+)$/i);
  if (descriptionMatch) {
    session.description = sanitizeUserText(descriptionMatch[1]);
    rebuild = true;
    notes.push('Updated the project brief and regenerated the scaffold files.');
  }

  const accentMatch = trimmed.match(/(?:set accent to|accent)\s+(#[0-9a-f]{6})/i);
  if (accentMatch) {
    session.accent = accentMatch[1].toLowerCase();
    rebuild = true;
    notes.push(`Changed the accent color to ${session.accent} and rebuilt the starter files.`);
  }

  const addPageMatch = trimmed.match(/^add page\s+(.+)$/i);
  if (addPageMatch) {
    const title = sanitizeUserText(addPageMatch[1]);
    const slug = slugify(title);
    if (slug && findPageIndex(session, title) === -1) {
      session.pages.push({
        title,
        slug,
        goal: `Draft the ${title} page in the site structure.`,
        sections: ['Hero', 'Core content', 'CTA'],
      });
      ensurePageSelection(session);
      filesOnly = true;
      notes.push(`Added a page brief for "${title}" and refreshed the preview plus content files.`);
    } else {
      notes.push(`Page "${title}" already exists in the session plan.`);
    }
  }

  const removePageMatch = trimmed.match(/^(?:remove page|delete page)\s+(.+)$/i);
  if (removePageMatch) {
    const token = sanitizeUserText(removePageMatch[1]);
    const index = findPageIndex(session, token);
    if (index >= 0 && session.pages.length > 1) {
      const [removed] = session.pages.splice(index, 1);
      ensurePageSelection(session);
      filesOnly = true;
      notes.push(`Removed "${removed.title}" from the page plan and refreshed the content files.`);
    } else if (index >= 0) {
      notes.push('The studio keeps at least one page in the plan, so the last page was not removed.');
    } else {
      notes.push(`No page matched "${token}".`);
    }
  }

  if (lower === 'rebuild' || lower === 'refresh scaffold') {
    rebuild = true;
    notes.push('Rebuilt the scaffold with the current session brief.');
  }

  if (!notes.length) {
    notes.push(
      'The builder did not find a structured action. Try one of: `/new site astro`, `rename site to ...`, `set description to ...`, `add page FAQ`, or `set accent to #2563eb`.',
    );
  }

  return { rebuild, filesOnly, message: notes.join('\n') };
}

async function handleSessionChat(session, text) {
  session.chat.push(userReply(text));
  const action = applyChatText(session, text);
  session.updatedAt = new Date().toISOString();

  if (action.rebuild) {
    await scaffoldSession(session);
  } else if (action.filesOnly) {
    await writeGeneratedArtifacts(session);
  }

  await saveSession(session);
  session.chat.push(assistantReply(action.message));
  await saveSession(session);
}

function renderPreviewBody(session, page) {
  const sections = page.sections
    .map(
      (section) => `
        <article class="section-card">
          <h3>${section}</h3>
          <p>${page.goal}</p>
        </article>
      `,
    )
    .join('');

  if (session.template === 'quarto-lesson') {
    return `
      <section class="hero lesson">
        <div>
          <p class="hero-eyebrow">Quarto lesson</p>
          <h1>${page.title}</h1>
          <p class="hero-body">${session.description}</p>
        </div>
        <div class="math-card">
          <strong>Preview note</strong>
          <p>This iframe is the studio preview surface. The actual scaffold is in ${session.projectRoot}.</p>
        </div>
      </section>
      <section class="grid">
        ${sections}
      </section>
    `;
  }

  if (session.template === 'astro-site') {
    return `
      <section class="docs-shell">
        <aside class="docs-sidebar">
          <strong>${session.siteName}</strong>
          ${session.pages
            .map((entry) => `<a href="/sites/${session.siteSlug}/${entry.slug}/">${entry.title}</a>`)
            .join('')}
        </aside>
        <article class="docs-article">
          <p class="hero-eyebrow">Astro site</p>
          <h1>${page.title}</h1>
          <p class="hero-body">${page.goal}</p>
          <div class="grid">
            ${sections}
          </div>
        </article>
      </section>
    `;
  }

  if (session.template === 'nextjs-app') {
    return `
      <section class="hero app-shell">
        <div>
          <p class="hero-eyebrow">Next.js app</p>
          <h1>${session.siteName}</h1>
          <p class="hero-body">${session.description}</p>
        </div>
        <div class="cta-card">
          <strong>${page.title}</strong>
          <p>${page.goal}</p>
        </div>
      </section>
      <section class="grid">
        ${sections}
      </section>
    `;
  }

  return `
    <section class="hero tool-shell">
      <div>
        <p class="hero-eyebrow">React + Vite</p>
        <h1>${session.siteName}</h1>
        <p class="hero-body">${page.goal}</p>
      </div>
      <div class="status-card">
        <strong>Studio-driven preview</strong>
        <p>Use chat to change the brief, add pages, and regenerate the starter files.</p>
      </div>
    </section>
    <section class="grid">
      ${sections}
    </section>
  `;
}

function renderPreviewPage(session, page) {
  const nav = session.pages
    .map((entry) => {
      const active = entry.slug === page.slug ? ' class="active"' : '';
      const href = entry.slug === session.homePageSlug ? `/sites/${session.siteSlug}/` : `/sites/${session.siteSlug}/${entry.slug}/`;
      return `<a${active} href="${href}">${entry.title}</a>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${session.siteName}</title>
    <style>
      :root {
        --accent: ${session.accent};
        --bg: #fbf7f2;
        --panel: rgba(255, 255, 255, 0.82);
        --text: #1d1813;
        --muted: #6a6157;
        --border: rgba(29, 24, 19, 0.1);
        --font: "Avenir Next", "Gill Sans", sans-serif;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: var(--font);
        color: var(--text);
        background:
          radial-gradient(circle at top right, color-mix(in srgb, var(--accent) 12%, white), transparent 18rem),
          linear-gradient(180deg, #fff8f1 0%, #f1e3d5 100%);
      }
      a { color: inherit; text-decoration: none; }
      .shell { width: min(1180px, calc(100vw - 2rem)); margin: 0 auto; padding: 1rem 0 2rem; }
      .topbar {
        display: flex;
        justify-content: space-between;
        gap: 1rem;
        align-items: center;
        padding: 1rem 1.2rem;
        border: 1px solid var(--border);
        border-radius: 20px;
        background: rgba(255, 255, 255, 0.76);
      }
      .brand strong { display: block; font-size: 1.1rem; }
      .brand span { color: var(--muted); font-size: 0.9rem; }
      nav { display: flex; gap: 0.65rem; flex-wrap: wrap; }
      nav a {
        padding: 0.55rem 0.85rem;
        border-radius: 999px;
        border: 1px solid var(--border);
        background: rgba(255,255,255,0.68);
      }
      nav a.active {
        border-color: color-mix(in srgb, var(--accent) 40%, white);
        background: color-mix(in srgb, var(--accent) 14%, white);
      }
      .hero, .docs-shell {
        margin-top: 1rem;
        border: 1px solid var(--border);
        border-radius: 28px;
        background: rgba(255, 255, 255, 0.78);
        padding: 1.35rem;
      }
      .hero { display: grid; grid-template-columns: 1.3fr 0.9fr; gap: 1rem; align-items: stretch; }
      .hero-eyebrow {
        margin: 0 0 0.65rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        font-size: 0.78rem;
        font-weight: 800;
        color: color-mix(in srgb, var(--accent) 72%, black);
      }
      h1 { margin: 0; font-size: clamp(2.2rem, 5vw, 4.4rem); line-height: 0.92; letter-spacing: -0.05em; }
      .hero-body { margin-top: 0.95rem; color: var(--muted); line-height: 1.7; font-size: 1.02rem; }
      .math-card, .cta-card, .status-card {
        border: 1px solid var(--border);
        border-radius: 22px;
        padding: 1rem;
        background: color-mix(in srgb, var(--accent) 8%, white);
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 1rem;
        margin-top: 1rem;
      }
      .section-card {
        border: 1px solid var(--border);
        border-radius: 22px;
        padding: 1rem;
        background: rgba(255,255,255,0.78);
      }
      .section-card h3 { margin: 0 0 0.5rem; font-size: 1.05rem; }
      .section-card p { margin: 0; color: var(--muted); line-height: 1.6; }
      .docs-shell { display: grid; grid-template-columns: 220px 1fr; gap: 1rem; }
      .docs-sidebar {
        display: grid;
        gap: 0.5rem;
        align-content: start;
        padding: 1rem;
        border-radius: 20px;
        background: rgba(251, 248, 244, 0.92);
      }
      .docs-sidebar a {
        padding: 0.5rem 0.65rem;
        border-radius: 12px;
      }
      .docs-sidebar a:hover { background: color-mix(in srgb, var(--accent) 10%, white); }
      .docs-article {
        padding: 0.25rem 0.15rem;
      }
      @media (max-width: 860px) {
        .hero, .docs-shell { grid-template-columns: 1fr; }
        .topbar { flex-direction: column; align-items: flex-start; }
      }
    </style>
  </head>
  <body>
    <div class="shell">
      <header class="topbar">
        <div class="brand">
          <strong>${session.siteName}</strong>
          <span>${session.template} preview routed from the MoFA site studio.</span>
        </div>
        <nav>${nav}</nav>
      </header>
      ${renderPreviewBody(session, page)}
    </div>
  </body>
</html>`;
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

function send(res, statusCode, body, contentType) {
  res.writeHead(statusCode, {
    'Cache-Control': 'no-store',
    'Content-Type': contentType,
  });
  res.end(body);
}

function sendJson(res, statusCode, payload) {
  send(res, statusCode, JSON.stringify(payload, null, 2), 'application/json; charset=utf-8');
}

function sendText(res, statusCode, payload) {
  send(res, statusCode, payload, 'text/plain; charset=utf-8');
}

async function serveStatic(req, res, pathname) {
  const normalized = pathname === '/' ? '/index.html' : pathname;
  const absolute = path.resolve(STUDIO_DIR, `.${normalized}`);
  if (!absolute.startsWith(STUDIO_DIR)) return false;
  if (!fs.existsSync(absolute) || fs.statSync(absolute).isDirectory()) return false;

  const ext = path.extname(absolute);
  const content = await fsp.readFile(absolute);
  send(res, 200, content, contentTypes[ext] || 'application/octet-stream');
  return true;
}

async function handleMeta(_req, res) {
  sendJson(res, 200, {
    presets: presetDefinitions,
  });
}

async function handleCreateSession(req, res) {
  const body = await readJsonBody(req);
  const presetKey = parseSessionCommand(body.command);
  const preset = presetDefinitions[presetKey];
  const siteName = sanitizeUserText(body.siteName) || preset.siteName;
  const description = sanitizeUserText(body.description) || preset.description;
  const siteSlug = uniqueSiteSlug(siteName);
  const sessionRoot = path.join(RUNTIME_ROOT, crypto.randomUUID());
  const projectRoot = path.join(sessionRoot, 'site');

  const session = {
    id: path.basename(sessionRoot),
    sessionRoot,
    projectRoot,
    siteSlug,
    siteName,
    description,
    accent: preset.accent,
    reference: preset.reference,
    referenceLabel: preset.referenceLabel,
    command: preset.command,
    presetKey,
    template: preset.template,
    siteKind: preset.siteKind,
    pages: clone(preset.pages),
    homePageSlug: preset.pages[0].slug,
    defaultFile: defaultFileForTemplate(preset.template),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    chat: [
      assistantReply(
        `Scaffold created from ${preset.template}. The right panel now reflects the generated site tree, and the iframe is routed under /sites/${siteSlug}/.`,
      ),
    ],
  };

  await scaffoldSession(session);
  await saveSession(session);
  registerSession(session);
  sendJson(res, 201, await buildSnapshot(session, req));
}

function sessionFromParam(id) {
  return sessionsById.get(id) || null;
}

async function handleGetSession(req, res, id) {
  const session = sessionFromParam(id);
  if (!session) {
    sendJson(res, 404, { error: `Unknown session: ${id}` });
    return;
  }
  sendJson(res, 200, await buildSnapshot(session, req));
}

async function handleFile(req, res, id, urlObject) {
  const session = sessionFromParam(id);
  if (!session) {
    sendJson(res, 404, { error: `Unknown session: ${id}` });
    return;
  }

  const filePath = String(urlObject.searchParams.get('path') || '');
  const absolute = path.resolve(session.projectRoot, filePath);
  if (!absolute.startsWith(session.projectRoot)) {
    sendJson(res, 400, { error: 'Invalid file path.' });
    return;
  }

  if (!fs.existsSync(absolute) || fs.statSync(absolute).isDirectory()) {
    sendJson(res, 404, { error: `File not found: ${filePath}` });
    return;
  }

  const ext = path.extname(absolute).toLowerCase();
  if (!textExtensions.has(ext)) {
    sendJson(res, 200, {
      path: filePath,
      content: 'Binary or unsupported file type. Open it from the project root if needed.',
    });
    return;
  }

  const content = await fsp.readFile(absolute, 'utf8');
  sendJson(res, 200, { path: filePath, content });
}

async function handleChat(req, res, id) {
  const session = sessionFromParam(id);
  if (!session) {
    sendJson(res, 404, { error: `Unknown session: ${id}` });
    return;
  }

  const body = await readJsonBody(req);
  const text = sanitizeUserText(body.text);
  if (!text) {
    sendJson(res, 400, { error: 'Chat text is required.' });
    return;
  }

  try {
    await handleSessionChat(session, text);
    sendJson(res, 200, await buildSnapshot(session, req));
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
}

async function handlePreview(req, res, pathname) {
  const parts = pathname.replace(/^\/+|\/+$/g, '').split('/');
  const siteSlug = parts[1];
  if (!siteSlug) {
    sendText(res, 404, 'Preview not found.');
    return;
  }

  const sessionId = sessionIdBySlug.get(siteSlug);
  const session = sessionId ? sessionsById.get(sessionId) : null;
  if (!session) {
    sendText(res, 404, `Unknown site slug: ${siteSlug}`);
    return;
  }

  const pageSlug = parts[2] || session.homePageSlug;
  const page = session.pages.find((entry) => entry.slug === pageSlug) || session.pages[0];
  send(res, 200, renderPreviewPage(session, page), 'text/html; charset=utf-8');
}

function loadExistingSessions() {
  fs.mkdirSync(RUNTIME_ROOT, { recursive: true });
  for (const entry of fs.readdirSync(RUNTIME_ROOT, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const sessionPath = path.join(RUNTIME_ROOT, entry.name, 'session.json');
    if (!fs.existsSync(sessionPath)) continue;
    try {
      const session = JSON.parse(fs.readFileSync(sessionPath, 'utf8'));
      registerSession(session);
    } catch {}
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const urlObject = new URL(req.url, `http://${req.headers.host || `${HOST}:${PORT}`}`);
    const { pathname } = urlObject;

    if (req.method === 'GET' && pathname === '/api/meta') {
      await handleMeta(req, res);
      return;
    }

    if (req.method === 'POST' && pathname === '/api/sessions') {
      await handleCreateSession(req, res);
      return;
    }

    const sessionMatch = pathname.match(/^\/api\/sessions\/([^/]+)$/);
    if (req.method === 'GET' && sessionMatch) {
      await handleGetSession(req, res, sessionMatch[1]);
      return;
    }

    const chatMatch = pathname.match(/^\/api\/sessions\/([^/]+)\/chat$/);
    if (req.method === 'POST' && chatMatch) {
      await handleChat(req, res, chatMatch[1]);
      return;
    }

    const fileMatch = pathname.match(/^\/api\/sessions\/([^/]+)\/file$/);
    if (req.method === 'GET' && fileMatch) {
      await handleFile(req, res, fileMatch[1], urlObject);
      return;
    }

    if (req.method === 'GET' && pathname.startsWith('/sites/')) {
      await handlePreview(req, res, pathname);
      return;
    }

    if (req.method === 'GET' && (await serveStatic(req, res, pathname))) {
      return;
    }

    sendJson(res, 404, { error: `No route for ${req.method} ${pathname}` });
  } catch (error) {
    sendJson(res, 500, { error: error.message || 'Internal server error' });
  }
});

loadExistingSessions();

server.listen(PORT, HOST, () => {
  console.log(`MoFA Site Studio listening on http://${HOST}:${PORT}`);
});
