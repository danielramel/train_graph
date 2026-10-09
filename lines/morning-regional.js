window.railGraphLines = window.railGraphLines || {};
window.railGraphLines['morning-regional'] = {
  name: 'Morning regional',
  trainName: 'RG 201',
  stations: [
    { id: 'northport', name: 'Northport', distance: 0, speed: 100 },
    { id: 'pine-junction', name: 'Pine Junction', distance: 8.4, speed: 120 },
    { id: 'riverside', name: 'Riverside', distance: 17.2, speed: 100 },
    { id: 'old-mill', name: 'Old Mill', distance: 25.9, speed: 80 },
    { id: 'hillcrest', name: 'Hillcrest', distance: 34.6, speed: 100 },
    { id: 'eastvale', name: 'Eastvale', distance: 42.8, speed: 0 },
  ],
  timetable: [
    { arrival: '06:40', run: 0, dwell: 0, platform: '1' },
    { arrival: '06:49', run: 9, dwell: 1, platform: '2' },
    { arrival: '06:58', run: 8, dwell: 1, platform: '1' },
    { arrival: '07:08', run: 9, dwell: 2, platform: '2' },
    { arrival: '07:20', run: 10, dwell: 1, platform: '1' },
    { arrival: '07:30', run: 9, dwell: 0, platform: '3' },
  ],
};
