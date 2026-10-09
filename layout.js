const workspacePages = [
  { href: 'infrastructure.html', icon: '▥', label: 'Infrastructure', index: '01' },
  { href: 'timetable.html', icon: '◷', label: 'Timetable', index: '02' },
  { href: 'train_graph.html', icon: '⌁', label: 'Train graph', index: '03' },
];

function renderWorkspaceNavigation() {
  const navigation = document.querySelector('#workspace-nav');
  if (!navigation) return;
  const currentPage = window.location.pathname.split(/[\\/]/).pop() || 'infrastructure.html';
  navigation.innerHTML = workspacePages.map((page) => `
    <a class="nav-item${page.href === currentPage ? ' active' : ''}" href="${page.href}">
      <span class="nav-icon">${page.icon}</span>
      <span>${page.label}</span>
      <span class="nav-index">${page.index}</span>
    </a>
  `).join('');
}

renderWorkspaceNavigation();
