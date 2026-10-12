const workspacePages = [
  { href: 'infrastructure.html', icon: '▥', label: 'Infrastructure', index: '01' },
  { href: 'timetable.html', icon: '◷', label: 'Timetable', index: '02' },
  { href: 'train_graph.html', icon: '⌁', label: 'Train graph', index: '03' },
];

function renderSidebar() {
  const sidebar = document.querySelector('#sidebar');
  if (!sidebar) return;
  sidebar.innerHTML = `
    <div class="brand">
      <a class="brand-mark" href="index.html" aria-label="Go to projects"><span></span><span></span><span></span></a>
      <div><strong><a href="index.html">RailGraph</a></strong><small>TRAIN GRAPH CREATOR</small></div>
      
    </div>
    <div class="sidebar-label">WORKSPACE</div>
    <nav class="main-nav" id="workspace-nav" aria-label="Workspace"></nav>
    <div class="sidebar-bottom">
      <div class="project-card">
        <div class="project-card-head"><span class="status-dot"></span><span>ACTIVE PROJECT</span></div>
        <strong id="sidebar-project-name">Morning regional</strong>
        <small id="sidebar-project-meta">6 stations · 42.8 km</small>
      </div>
    </div>
  `;
}

function renderWorkspaceNavigation() {
  const navigation = document.querySelector('#workspace-nav');
  if (!navigation) return;
  const shell = document.querySelector('.app-shell');
  shell?.classList.add('sidebar-collapsed');
  const currentPage = window.location.pathname.split(/[\\/]/).pop() || 'infrastructure.html';
  navigation.innerHTML = workspacePages.map((page) => `
    <a class="nav-item${page.href === currentPage ? ' active' : ''}" href="${page.href}">
      <span class="nav-icon">${page.icon}</span>
      <span>${page.label}</span>
      <span class="nav-index">${page.index}</span>
    </a>
  `).join('');
}

renderSidebar();
renderWorkspaceNavigation();
