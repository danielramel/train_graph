window.railGraphLines = window.railGraphLines || {};
window.railGraphLines['morning-regional'] = {
  name: 'Morning regional',
  trains: [{
    id: 'rg-201',
    name: 'RG 201',
    timetable: [
      { arrival: '06:40', departure: '06:40', run: 0, dwell: 0 },
      { arrival: '06:49', run: 9, dwell: 1 },
      { arrival: '06:58', run: 8, dwell: 1 },
      { arrival: '07:08', run: 9, dwell: 2 },
      { arrival: '07:20', run: 10, dwell: 1 },
      { arrival: '07:30', run: 9, dwell: 0 },
    ],
  }],
  stations: [
    { id: 'northport', name: 'Northport', distance: 0, speed: 100, tracks: 2 },
    { id: 'pine-junction', name: 'Pine Junction', distance: 8.4, speed: 120, tracks: 2 },
    { id: 'riverside', name: 'Riverside', distance: 17.2, speed: 100, tracks: 2 },
    { id: 'old-mill', name: 'Old Mill', distance: 25.9, speed: 80, tracks: 2 },
    { id: 'hillcrest', name: 'Hillcrest', distance: 34.6, speed: 100, tracks: 2 },
    { id: 'eastvale', name: 'Eastvale', distance: 42.8, speed: 0, tracks: 2 },
  ],
};
