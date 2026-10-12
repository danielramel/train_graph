window.railGraphLines = window.railGraphLines || {};
window.railGraphLines['30a'] = {
  name: 'MÁV 30a (Kelenföld - Székesfehérvár)',
  trains: [{
    id: 'z30-4512',
    name: 'Z30 4512',
    timetable: [
      { arrival: '08:07', departure: '08:07', run: 0, dwell: 0 },
      { arrival: '08:16', run: 9, dwell: 1 },
      { arrival: '08:20', run: 3, dwell: 1 },
      { arrival: '08:26', run: 5, dwell: 1 },
      { arrival: '08:29', run: 2, dwell: 1 },
      { arrival: '08:32', run: 2, dwell: 1 },
      { arrival: '08:35', run: 2, dwell: 1 },
      { arrival: '08:38', run: 2, dwell: 1 },
      { arrival: '08:40', run: 1, dwell: 1 },
      { arrival: '08:43', run: 2, dwell: 1 },
      { arrival: '08:45', run: 1, dwell: 1 },
      { arrival: '08:48', run: 2, dwell: 1 },
      { arrival: '08:59', run: 10, dwell: 0 }
    ],
  }],
  stations: [
    { id: 'kelenfold', name: 'Budapest-Kelenföld', distance: 0, speed: 120, tracks: 4 },
    { id: 'erd-also', name: 'Érd alsó', distance: 13.0, speed: 120, tracks: 2 },
    { id: 'tarnok', name: 'Tárnok', distance: 18.0, speed: 120, tracks: 2 },
    { id: 'martonvasar', name: 'Martonvásár', distance: 25.0, speed: 120, tracks: 2 },
    { id: 'baracska', name: 'Baracska', distance: 29.0, speed: 120, tracks: 2 },
    { id: 'pettend', name: 'Pettend', distance: 31.0, speed: 120, tracks: 2 },
    { id: 'kapolnasnyek', name: 'Kápolnásnyék', distance: 34.0, speed: 120, tracks: 2 },
    { id: 'velence', name: 'Velence', distance: 37.0, speed: 120, tracks: 2 },
    { id: 'velencefurdo', name: 'Velencefürdő', distance: 38.5, speed: 120, tracks: 2 },
    { id: 'gardony', name: 'Gárdony', distance: 40.5, speed: 120, tracks: 2 },
    { id: 'agard', name: 'Agárd', distance: 42.5, speed: 120, tracks: 2 },
    { id: 'dinnyes', name: 'Dinnyés', distance: 46.5, speed: 120, tracks: 2 },
    { id: 'szekesfehervar', name: 'Székesfehérvár', distance: 60.0, speed: 120, tracks: 4 }
  ],
};