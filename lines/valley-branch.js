window.railGraphLines = window.railGraphLines || {};
window.railGraphLines['valley-branch'] = {
  name: 'Valley branch',
  trainName: 'VB 104',
  stations: [
    { id: 'cedar-falls', name: 'Cedar Falls', distance: 0, speed: 80 },
    { id: 'maple-crossing', name: 'Maple Crossing', distance: 6.2, speed: 90 },
    { id: 'brookfield', name: 'Brookfield', distance: 13.8, speed: 70 },
    { id: 'stonebridge', name: 'Stonebridge', distance: 21.4, speed: 80 },
    { id: 'summit', name: 'Summit', distance: 28.6, speed: 0 },
  ],
  timetable: [
    { arrival: '07:10', departure: '07:10', run: 0, dwell: 0 },
    { arrival: '07:16', run: 6, dwell: 1 },
    { arrival: '07:23', run: 7, dwell: 1 },
    { arrival: '07:30', run: 7, dwell: 1 },
    { arrival: '07:37', run: 7, dwell: 0 },
  ],
};
