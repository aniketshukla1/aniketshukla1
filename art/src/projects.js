// The cards: what each project is, in one breath, what it's built with, a real screen of it, and where to go next.
export const PROJECTS = {
  'superuser': {
    name: 'Superuser', accent: '#8b8cf6', logo: 'superuser.png', shot: 'superuser.webp',
    stack: ['Rust', 'Tauri', 'React', 'TypeScript', 'macOS'],
    line: 'The AI you can tell everything. It runs on your machine, asks before it acts, and shows you everything that left.',
    link: { label: 'Website', shown: 'aniketshukla1.github.io/superuser', icon: 'globe' },
  },
  'glaux': {
    name: 'Glaux', accent: '#2dd4bf', logo: 'glaux.svg', shot: 'glaux.webp',
    stack: ['Python', 'Rust', 'FastAPI', 'React', 'Tauri'],
    line: 'A multi-agent swarm that proves its work. Every step is signed onto a tamper-evident, hash-chained ledger.',
    link: { label: 'Website', shown: 'aniketshukla1.github.io/glaux', icon: 'globe' },
  },
  'athenadb': {
    name: 'AthenaDB', accent: '#818cf8', logo: 'athenadb.svg', shot: 'athenadb.webp',
    stack: ['Rust', 'Python', 'Axum', 'SIMD'],
    line: 'Exact vector search in Rust, with crash-consistent storage. Embed it in Python or Rust, with no server to run.',
    link: { label: 'Website', shown: 'aniketshukla1.github.io/athenadb', icon: 'globe' },
  },
  'root': {
    name: 'root', accent: '#f97066', logo: 'root-{theme}.svg', shot: 'root.webp',
    stack: ['Rust', 'Tauri', 'React', 'TypeScript', 'Axum'],
    line: 'Monitoring tells you something is wrong. root tells you why, across 31 kinds of infrastructure.',
    link: { label: 'Website', shown: 'aniketshukla1.github.io/root', icon: 'globe' },
  },
  'ferro': {
    name: 'ferro', accent: '#fb923c', logo: 'ferro.png', shot: 'ferro.webp',
    stack: ['Rust', 'Tauri', 'Tree-sitter', 'SQLite'],
    line: 'Fast local code review for humans and AI. Understand your changes before you push.',
    link: { label: 'Website', shown: 'aniketshukla1.github.io/ferro', icon: 'globe' },
  },
  'mnesio': {
    name: 'mnesio', accent: '#38bdf8', logo: 'mnesio.png', shot: 'mnesio.webp',
    stack: ['Rust', 'MCP', 'Python', 'Node.js', 'Tree-sitter'],
    line: 'Memory that helps AI agents learn from outcomes, and improves their policies through a safety gate.',
    link: { label: 'Website', shown: 'mnesio.github.io/mnesio', icon: 'globe' },
  },
  'murmuration': {
    name: 'Murmuration', accent: '#f0a97a', logo: 'murmuration.svg', logoFull: true, shot: 'murmuration.webp',
    stack: ['JavaScript', 'WebGL', 'Three.js', 'HTML', 'CSS'],
    line: 'Websites that move like what they’re about. An open agent skill that builds real 3D in plain HTML, CSS and JS.',
    link: { label: 'Website', shown: 'aniketshukla1.github.io/murmuration', icon: 'globe' },
  },
  'fiddlehead': {
    name: 'Fiddlehead', accent: '#34d399', logo: 'fiddlehead.svg', logoFull: true, shot: 'fiddlehead.webp',
    stack: ['Python', 'PyTorch', 'FastAPI', 'React', 'Three.js'],
    line: 'An open-source studio for training and serving your own small AI models, with a live view inside the network.',
    link: { label: 'Website', shown: 'aniketshukla1.github.io/fiddlehead', icon: 'globe' },
  },
  'sdlc-kit': {
    name: 'sdlc-kit', accent: '#60a5fa', logo: null, mark: '✓', shot: 'sdlc-kit.webp',
    stack: ['Shell', 'Python', 'Cursor', 'Jira', 'GitLab'],
    line: 'Jira ticket in, reviewed GitLab MR out. A drop-in kit where scripts, not the agent, decide when it’s done.',
    link: { label: 'Website', shown: 'aniketshukla1.github.io/sdlc-kit', icon: 'globe' },
  },
  'verso': {
    name: 'Verso', accent: '#93a2f2', logo: 'verso.png', shot: 'verso.webp',
    stack: ['TypeScript', 'React Native', 'Expo', 'PostgreSQL'],
    line: 'Scan a food label and see which ingredients are banned or restricted, where, and who decided, with sources.',
    link: { label: 'Website', shown: 'aniketshukla1.github.io/verso', icon: 'globe' },
  },
  'agent-cli': {
    name: 'agent-cli', accent: '#a3e635', logo: null, mark: '›_',
    stack: ['Rust', 'Ratatui', 'Tokio', 'MCP'],
    line: 'A fast AI agent for your terminal, in Rust, with an interactive TUI, MCP and skills.',
    link: { label: 'Quick start', shown: 'github.com/aniketshukla1/agent-cli', icon: 'book' },
  },
};
