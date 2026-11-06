// The cards: what each project is, in one breath, and a real screen of it.
export const PROJECTS = {
  superuser: {
    name: 'Superuser', meta: 'macOS', soon: true, accent: '#8b8cf6',
    logo: null, mark: '#',
    line: 'The AI you can tell everything. It runs on your machine, asks before it acts, and shows you everything that left.',
  },
  glaux: {
    name: 'Glaux', meta: 'Python · Rust', accent: '#2dd4bf', logo: 'glaux.svg', shot: 'glaux.webp',
    line: 'A multi-agent swarm that proves its work. Every step is signed onto a tamper-evident, hash-chained ledger.',
  },
  athenadb: {
    name: 'AthenaDB', meta: 'Rust', accent: '#818cf8', logo: 'athenadb.svg', shot: 'athenadb.webp',
    line: 'Exact vector search in Rust, with crash-consistent storage. Embed it in Python or Rust, with no server to run.',
  },
  root: {
    name: 'root', meta: 'Rust', accent: '#f97066', logo: 'root-{theme}.svg', shot: 'root.webp',
    line: 'Monitoring tells you something is wrong. root tells you why, across 31 kinds of infrastructure.',
  },
  ferro: {
    name: 'ferro', meta: 'Rust', accent: '#fb923c', logo: 'ferro.png', shot: 'ferro.webp',
    line: 'Fast local code review for humans and AI. Understand your changes before you push.',
  },
  mnesio: {
    name: 'mnesio', meta: 'Rust', accent: '#38bdf8', logo: 'mnesio.png', shot: 'mnesio.webp',
    line: 'Memory that helps AI agents learn from outcomes, and improves their policies through a safety gate.',
  },
  murmuration: {
    name: 'Murmuration', meta: 'JavaScript', accent: '#f0a97a', logo: 'murmuration.svg', logoFull: true, shot: 'murmuration.webp',
    line: 'Websites that move like what they’re about. An open agent skill that builds real 3D in plain HTML, CSS and JS.',
  },
  fiddlehead: {
    name: 'Fiddlehead', meta: 'Python · JavaScript', accent: '#34d399', logo: 'fiddlehead.svg', logoFull: true, shot: 'fiddlehead.webp',
    line: 'An open-source studio for training and serving your own small AI models, with a live view inside the network.',
  },
  'sdlc-kit': {
    name: 'sdlc-kit', meta: 'Shell', accent: '#60a5fa', logo: null, mark: '✓', shot: 'sdlc-kit.webp',
    line: 'Jira ticket in, reviewed GitLab MR out. A drop-in kit where scripts, not the agent, decide when it’s done.',
  },
  'agent-cli': {
    name: 'agent-cli', meta: 'Rust', accent: '#a3e635', logo: null, mark: '›_',
    line: 'A fast AI agent for your terminal, in Rust, with an interactive TUI, MCP and skills.',
  },
};
