'use client'

import React, { useEffect, useRef } from 'react'
import 'leaflet/dist/leaflet.css'

// Built-in dictionary of major cities
const CITY_COORDS: Record<string, [number, number]> = {
  'Berlin': [52.52, 13.405],
  'London': [51.5074, -0.1278],
  'Amsterdam': [52.3676, 4.9041],
  'Paris': [48.8566, 2.3522],
  'Madrid': [40.4168, -3.7038],
  'Barcelona': [41.3851, 2.1734],
  'Ibiza': [38.9067, 1.4206],
  'Manchester': [53.4808, -2.2426],
  'New York': [40.7128, -74.006],
  'New York City': [40.7128, -74.006],
  'Los Angeles': [34.0522, -118.2437],
  'Chicago': [41.8781, -87.6298],
  'Miami': [25.7617, -80.1918],
  'Sao Paulo': [-23.5505, -46.6333],
  'Rio de Janeiro': [-22.9068, -43.1729],
  'Bogotá': [4.711, -74.0721],
  'Medellin': [6.2442, -75.5812],
  'Tokyo': [35.6762, 139.6503],
  'Sydney': [-33.8688, 151.2093],
  'Melbourne': [-37.8136, 144.9631],
  'Toronto': [43.6510, -79.3470],
  'Montreal': [45.5017, -73.5673],
  'Mexico City': [19.4326, -99.1332],
  'Guadalajara': [20.6597, -103.3496],
  'Buenos Aires': [-34.6037, -58.3816],
  'Santiago': [-33.4489, -70.6693],
  'Lima': [-12.0464, -77.0428],
  'Cape Town': [-33.9249, 18.4241],
  'Johannesburg': [-26.2041, 28.0473],
  'Dubai': [25.2048, 55.2708],
  'Bali': [-8.4095, 115.1889],
  'Bangkok': [13.7563, 100.5018],
  'Kuala Lumpur': [3.139, 101.6869],
  'Singapore': [1.3521, 103.8198],
  'Hong Kong': [22.3193, 114.1694],
  'Seoul': [37.5665, 126.9780],
  'Taipei': [25.0330, 121.5654],
  'San Francisco': [37.7749, -122.4194],
  'San Francisco/Oakland': [37.7749, -122.4194],
  'Denver': [39.7392, -104.9903],
  'Dallas/Fort Worth': [32.7767, -96.7970],
  'Phoenix': [33.4484, -112.0740],
  'Las Vegas': [36.1699, -115.1398],
  'Seattle': [47.6062, -122.3321],
  'Atlanta': [33.7490, -84.3880],
  'Washington DC': [38.9072, -77.0369],
  'Detroit': [42.3314, -83.0458],
  'Dublin': [53.3498, -6.2603],
  'Belfast': [54.5973, -5.9301],
  'Glasgow': [55.8642, -4.2518],
  'Bristol': [51.4545, -2.5879],
  'Munich': [48.1351, 11.5820],
  'Hamburg': [53.5511, 9.9937],
  'Frankfurt': [50.1109, 8.6821],
  'Hesse': [50.1109, 8.6821],
  'Cologne': [50.9375, 6.9603],
  'Milan': [45.4642, 9.1900],
  'Rome': [41.9028, 12.4964],
  'Turin': [45.0703, 7.6869],
  'Florence': [43.7695, 11.2558],
  'Naples': [40.8518, 14.2681],
  'Athens': [37.9838, 23.7275],
  'Istanbul': [41.0082, 28.9784],
  'Lisbon': [38.7223, -9.1393],
  'Porto': [41.1579, -8.6291],
  'Vienna': [48.2082, 16.3738],
  'Zurich': [47.3769, 8.5417],
  'Geneva': [46.2044, 6.1432],
  'Brussels': [50.8503, 4.3517],
  'Ghent': [51.0543, 3.7174],
  'Antwerp': [51.2194, 4.4025],
  'Copenhagen': [55.6761, 12.5683],
  'Stockholm': [59.3293, 18.0686],
  'Oslo': [59.9139, 10.7522],
  'Helsinki': [60.1695, 24.9354],
  'Warsaw': [52.2297, 21.0122],
  'Prague': [50.0755, 14.4378],
  'Budapest': [47.4979, 19.0402],
  'Bucharest': [44.4268, 26.1025],
  'Belgrade': [44.8125, 20.4612],
  'Zagreb': [45.8150, 15.9819],
  'Tbilisi': [41.7151, 44.8271],
  'Vilnius': [54.6872, 25.2797],
  'Riga': [56.9496, 24.1052],
  'Tallinn': [59.4370, 24.7536],
  'Reykjavik': [64.1466, -21.9426],
}

export default function RaveMap({ events }: { events: any[] }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // Compute city counts
    const cityCounts: Record<string, number> = {}
    events.forEach(e => {
      const city = e.venue?.city
      if (city && CITY_COORDS[city]) {
        cityCounts[city] = (cityCounts[city] || 0) + 1
      } else if (e.venue?.name?.includes('Ibiza') || e.venue?.city === 'Ibiza') {
        cityCounts['Ibiza'] = (cityCounts['Ibiza'] || 0) + 1
      }
    })

    // Imperatively init Leaflet so we fully control cleanup and avoid
    // "Map container is already initialized" from React Strict Mode double-invoke.
    import('leaflet').then(({ default: L }) => {
      // Destroy any existing map on this container before creating a new one
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }

      const map = L.map(container, {
        center: [48.8566, 2.3522],
        zoom: 4,
        scrollWheelZoom: false,
        zoomControl: true,
      })
      mapRef.current = map

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; CARTO',
      }).addTo(map)

      Object.entries(cityCounts).forEach(([city, count]) => {
        const coords = CITY_COORDS[city]
        if (!coords) return
        L.circleMarker(coords, {
          radius: Math.min(10 + count * 3, 30),
          fillColor: '#8b5cf6',
          color: '#c4b5fd',
          weight: 2,
          fillOpacity: 0.6,
        })
          .addTo(map)
          .bindPopup(`<strong>${city}</strong><br/>${count} event${count > 1 ? 's' : ''} here`)
      })
    })

    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [events])

  return (
    <div style={{ height: '400px', width: '100%', borderRadius: '16px', overflow: 'hidden' }}>
      <div ref={containerRef} style={{ height: '100%', width: '100%' }} />
    </div>
  )
}
