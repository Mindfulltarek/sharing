import type { Project, ProjectFile } from './types';

export const DEMO_LOCKED_PASSWORD = 'KYOTO7';

const stamp = (text: string) => new TextEncoder().encode(text).length;

const makeFile = (name: string, type: string, content: string, id: string): ProjectFile => ({
  id,
  name,
  size: stamp(content),
  type,
  modifiedAt: Date.now() - 1000 * 60 * 60 * 24 * 3,
  downloadCount: 0,
  demo: true,
});

const sampleContent: Record<string, string> = {
  'Brand-direction.md': `# Northstar Studio — brand direction\n\nA quiet, confident identity built around clarity and craft. The system pairs a warm charcoal canvas with a violet signal color and generous breathing room.\n\n## Principles\n- Make the useful thing unmistakable.\n- Keep every detail intentional.\n- Let the work, not the decoration, lead.\n\n## Color\nViolet is reserved for moments of action. Soft lavender is used for supporting highlights; ink and chalk carry the rest of the system.\n\nPrepared for the Northstar team.\n`,
  'Northstar-mark.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 180"><defs><linearGradient id="g" x1="0" x2="1"><stop stop-color="#a78bfa"/><stop offset="1" stop-color="#ec4899"/></linearGradient></defs><rect width="420" height="180" rx="24" fill="#111018"/><path d="M56 122V58l48 64V58" fill="none" stroke="url(#g)" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/><text x="132" y="106" fill="#f4f1f8" font-family="Arial,sans-serif" font-size="34" font-weight="600">northstar</text><text x="134" y="132" fill="#a69eaf" font-family="Arial,sans-serif" font-size="12" letter-spacing="3">STUDIO IDENTITY</text></svg>`,
  'Palette.csv': `token,hex,usage\nink,#111018,Primary canvas\nchalk,#F4F1F8,Primary text\nviolet,#A78BFA,Action accent\nrose,#EC4899,Gradient highlight\nlavender,#D8CCFF,Secondary accent\n`,
  'Handoff-notes.txt': `NORTHSTAR STUDIO / HANDOFF\n\nThe identity package is organized by source format.\nUse the violet-to-rose blend sparingly for moments that need emphasis.\n\nPrepared for review · Demo sample\n`,
  'Kyoto-itinerary.md': `# Kyoto — field notes\n\n## Friday\n- 09:15 — Coffee near the river\n- 11:00 — Walk the eastern lanes\n- 16:30 — Golden-hour street portraits\n\n## Saturday\n- Early start at the shrine paths\n- Keep the afternoon open for rain\n- Back up the selects before dinner\n\nA lightweight trip plan for a small creative crew.\n`,
  'Shot-list.csv': `scene,frame,notes\nRiver path,Wide,Leave room for the morning light\nMarket lane,Detail,Look for color and texture\nTemple approach,Portrait,Keep the background soft\nEvening signs,Street,Handheld; watch reflections\n`,
  'Trip-card.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 360"><defs><linearGradient id="sky" x2="0" y2="1"><stop stop-color="#38265d"/><stop offset="1" stop-color="#e87791"/></linearGradient></defs><rect width="600" height="360" rx="28" fill="url(#sky)"/><circle cx="455" cy="94" r="38" fill="#ffd9b0" opacity=".9"/><path d="M0 250 130 155l110 93 105-122 155 124 100-53v163H0z" fill="#21182e" opacity=".8"/><path d="M0 292q120-35 250 0t350 0v68H0z" fill="#17131e"/><text x="42" y="64" fill="#fff" font-family="Arial,sans-serif" font-size="16" letter-spacing="4">FIELD NOTES / 01</text><text x="42" y="315" fill="#fff" font-family="Arial,sans-serif" font-size="28" font-weight="600">KYOTO, SLOWLY</text></svg>`,
  'Travel-notes.txt': `KYOTO FIELD NOTES\n\nRoute changes are fine. Leave time for the small streets, carry a light layer, and keep one card free for the moments we did not plan.\n\nPasscode-protected demo project.\n`,
  'Launch-brief.md': `# Lumen — release kit\n\nA compact handoff for the launch team. This demo bundle includes the messaging outline, campaign schedule, a vector social card, and press notes.\n\n## Voice\nDirect, warm, and specific. Start with what changed for the person using it.\n\n## Checklist\n- Final review of release copy\n- Confirm publication windows\n- Keep source files together with this brief\n`,
  'Campaign-calendar.csv': `date,channel,asset\n2026-10-20,Newsletter,Release note\n2026-10-22,Social,Launch card\n2026-10-24,Website,Product story\n`,
  'Lumen-social-card.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 450"><defs><linearGradient id="b" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#392a71"/><stop offset="1" stop-color="#b05283"/></linearGradient></defs><rect width="800" height="450" rx="32" fill="#100f17"/><circle cx="617" cy="88" r="125" fill="#a78bfa" opacity=".13"/><circle cx="690" cy="355" r="160" fill="#ec4899" opacity=".12"/><rect x="40" y="40" width="720" height="370" rx="24" fill="url(#b)" opacity=".56"/><text x="86" y="145" fill="#e3dafd" font-family="Arial,sans-serif" font-size="19" letter-spacing="5">LUMEN / RELEASE 01</text><text x="82" y="252" fill="#fff" font-family="Arial,sans-serif" font-size="58" font-weight="700">Make room</text><text x="82" y="318" fill="#fff" font-family="Arial,sans-serif" font-size="58" font-weight="700">for what matters.</text></svg>`,
  'Press-notes.md': `# Press notes\n\nUse these notes as a starting point for editorial outreach. Keep the product details concrete and avoid claims that are not included in the final release.\n\n**Status:** review draft\n`,
  'Archive-readme.txt': `ARCHIVE / WINTER CAMPAIGN\n\nThis demo project has expired. The sample metadata remains in the local workspace so the owner can explore the re-upload flow.\n`,
  'Exploration-board.md': `# Winter exploration\n\nA retired moodboard and early direction notes. This project is included as a demo example of an expired share.\n`,
  'Shared-handoff.md': `# Studio handoff\n\nA sample project saved from a collaborator. This local demo copy is read-only and can be opened while the sample share is available.\n`,
};

export function getDemoContent(file: ProjectFile): string | null {
  return sampleContent[file.name] ?? null;
}

export function makeSampleFile(name: string, type: string, id = `sample-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`): ProjectFile {
  const content = sampleContent[name] ?? `Demo sample: ${name}\n\nThis placeholder is generated locally for the Sharing demo.\n`;
  return makeFile(name, type, content, id);
}

function makeToken() {
  const bytes = new Uint8Array(18);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function project(
  id: string,
  name: string,
  fileSpecs: Array<[string, string]>,
  privacy: Project['privacy'],
  createdOffset: number,
  expiryOffset: number | null,
  views: number,
  downloads: number,
): Project {
  const now = Date.now();
  return {
    id,
    token: privacy === 'private' ? null : makeToken(),
    name,
    files: fileSpecs.map(([fileName, fileType]) => makeSampleFile(fileName, fileType, `${id}-${fileName}`)),
    createdAt: now - createdOffset,
    updatedAt: now - Math.max(1000 * 60 * 12, createdOffset / 4),
    expiresAt: expiryOffset === null ? null : now + expiryOffset,
    privacy,
    passwordHash: privacy === 'password' ? '729899adbd659bb59d9ee0888e847ac8556d0c69a735ecbc5f89b7491c185f50' : undefined,
    views,
    downloads,
  };
}

export function seedProjects(): Project[] {
  const day = 24 * 60 * 60 * 1000;
  const projects = [
    project('demo-northstar', 'Northstar identity kit', [
      ['Brand-direction.md', 'text/markdown'],
      ['Northstar-mark.svg', 'image/svg+xml'],
      ['Palette.csv', 'text/csv'],
      ['Handoff-notes.txt', 'text/plain'],
    ], 'open', 4 * day, 6 * day, 128, 22),
    project('demo-kyoto', 'Kyoto field notes', [
      ['Kyoto-itinerary.md', 'text/markdown'],
      ['Shot-list.csv', 'text/csv'],
      ['Trip-card.svg', 'image/svg+xml'],
      ['Travel-notes.txt', 'text/plain'],
    ], 'password', 10 * day, 2 * day, 76, 14),
    project('demo-lumen', 'Lumen launch pack', [
      ['Launch-brief.md', 'text/markdown'],
      ['Campaign-calendar.csv', 'text/csv'],
      ['Lumen-social-card.svg', 'image/svg+xml'],
      ['Press-notes.md', 'text/markdown'],
    ], 'private', 16 * day, null, 0, 0),
    project('demo-archive', 'Winter campaign archive', [
      ['Archive-readme.txt', 'text/plain'],
      ['Exploration-board.md', 'text/markdown'],
    ], 'open', 48 * day, -1 * day, 211, 37),
  ];
  // The protected sample stores only a SHA-256 verification hash, never its passcode.
  return projects;
}

export function seedSharedProject(): Project {
  const day = 24 * 60 * 60 * 1000;
  return project('shared-studio-handoff', 'Studio handoff', [
    ['Shared-handoff.md', 'text/markdown'],
    ['Palette.csv', 'text/csv'],
    ['Northstar-mark.svg', 'image/svg+xml'],
  ], 'open', 2 * day, 5 * day, 18, 6);
}
