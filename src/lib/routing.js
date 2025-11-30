// OSRM endpoint for routing
const OSRM_ENDPOINT = 'https://router.project-osrm.org/route/v1';

/**
 * Get a road-following path between two points using OSRM
 */
export const getRouteBetweenPoints = async (start, end) => {
  try {
    const response = await fetch(
      `${OSRM_ENDPOINT}/driving/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`
    );

    if (!response.ok) {
      throw new Error('Failed to fetch route');
    }

    const data = await response.json();

    if (data.code !== 'Ok' || !data.routes[0]?.geometry?.coordinates) {
      throw new Error('No route found');
    }

    // OSRM returns coordinates in [lng, lat] format, we need to convert to [lat, lng]
    return data.routes[0].geometry.coordinates.map(coord => [coord[1], coord[0]]);
  } catch (error) {
    console.error('Error fetching route:', error);
    // Fall back to direct line if routing fails
    return [[start.lat, start.lng], [end.lat, end.lng]];
  }
};

/**
 * Get road-following paths for an array of tracking points
 * Will combine direct lines for points that are close together
 */
export const getRouteForTrackingPoints = async (points, maxDirectDistance = 100) => {
  if (points.length < 2) {
    return points.map(p => [p.lat, p.lng]);
  }

  const routes = [];
  let lastRoutedPoint = points[0];
  let pointBuffer = [points[0]];

  for (let i = 1; i < points.length; i++) {
    const currentPoint = points[i];
    const distance = getDistanceInMeters(lastRoutedPoint, currentPoint);

    if (distance > maxDirectDistance) {
      // Get road route for accumulated points
      if (pointBuffer.length > 1) {
        const directLines = pointBuffer.map(p => [p.lat, p.lng]);
        routes.push(directLines);
      }

      // Get road route to the current point
      const roadRoute = await getRouteBetweenPoints(lastRoutedPoint, currentPoint);
      routes.push(roadRoute);

      lastRoutedPoint = currentPoint;
      pointBuffer = [currentPoint];
    } else {
      pointBuffer.push(currentPoint);
    }
  }

  // Add any remaining buffered points
  if (pointBuffer.length > 1) {
    const directLines = pointBuffer.map(p => [p.lat, p.lng]);
    routes.push(directLines);
  }

  // Flatten all routes into a single array of coordinates
  return routes.flat();
};

/**
 * Calculate distance between two points in meters
 */
const getDistanceInMeters = (point1, point2) => {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = point1.lat * Math.PI / 180;
  const φ2 = point2.lat * Math.PI / 180;
  const Δφ = (point2.lat - point1.lat) * Math.PI / 180;
  const Δλ = (point2.lng - point1.lng) * Math.PI / 180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c;
};
