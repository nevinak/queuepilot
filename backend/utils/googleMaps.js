async function getDistanceAndDuration(origin) {
  try {
    const key = process.env.GOOGLE_MAPS_API_KEY || 'AIzaSyA9v4DXKblt03LTo06chAP1G6_XnFDJhuQ';
    const destination = 'VPS Lakeshore Hospital, Kochi, Kerala, India';
    
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(origin)}&destinations=${encodeURIComponent(destination)}&key=${key}`;
    const res = await fetch(url);
    const data = await res.json();
    
    if (data && data.rows && data.rows[0] && data.rows[0].elements && data.rows[0].elements[0]) {
      const element = data.rows[0].elements[0];
      if (element.status === 'OK') {
        const distanceText = element.distance.text;
        const durationText = element.duration.text;
        const durationSeconds = element.duration.value;
        const durationMinutes = Math.ceil(durationSeconds / 60);
        return {
          distance: distanceText,
          duration: durationText,
          durationMinutes: durationMinutes,
          success: true
        };
      }
    }
    throw new Error('Google maps response status not OK');
  } catch (error) {
    console.error('Error fetching from Google Maps Distance Matrix:', error.message);
    // Safe fallback estimates based on origin description:
    const lowerOrig = (origin || '').toLowerCase();
    if (lowerOrig.includes('aluva')) {
      return { distance: '28 km', duration: '45 mins', durationMinutes: 45, success: false };
    } else if (lowerOrig.includes('tripunithura')) {
      return { distance: '12 km', duration: '20 mins', durationMinutes: 20, success: false };
    } else if (lowerOrig.includes('kakkanad')) {
      return { distance: '16 km', duration: '25 mins', durationMinutes: 25, success: false };
    } else if (lowerOrig.includes('edappally')) {
      return { distance: '14 km', duration: '22 mins', durationMinutes: 22, success: false };
    } else {
      return { distance: '1.8 km', duration: '6 mins', durationMinutes: 6, success: false };
    }
  }
}

module.exports = { getDistanceAndDuration };
