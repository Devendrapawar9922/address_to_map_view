'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

interface Location {
  coordinates: [number, number];
  address: string;
  type: 'current' | 'selected' | 'searched';
  timestamp: number;
}

interface MapProps {
  apiKey: string;
  onMapClick: (e: mapboxgl.MapMouseEvent) => void;
  locations: Location[];
  initialCoords: [number, number] | null;
}

const Map = ({ apiKey, onMapClick, locations, initialCoords }: MapProps) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [markerMap, setMarkerMap] = useState<{ [key: number]: mapboxgl.Marker }>({});
  const [isMapInitialized, setIsMapInitialized] = useState(false);

  const defaultCoords = {
    lng: 55.2708,
    lat: 25.2048,
    zoom: 10,
  };

  // Initialize the map
  useEffect(() => {
    if (!apiKey) {
      console.error('Mapbox API key is missing');
      return;
    }
    if (mapRef.current || !mapContainerRef.current) return;

    try {
      mapboxgl.accessToken = apiKey;

      const center = initialCoords || [defaultCoords.lng, defaultCoords.lat];

      mapRef.current = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: 'mapbox://styles/mapbox/streets-v11',
        center,
        zoom: initialCoords ? 14 : defaultCoords.zoom,
      });

      mapRef.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

      mapRef.current.on('load', () => {
        mapRef.current?.resize();
        setIsMapInitialized(true);
      });

      mapRef.current.on('click', (e: mapboxgl.MapMouseEvent) => {
        onMapClick(e);
      });

      mapRef.current.on('error', (e) => {
        console.error('Mapbox error:', e);
      });
    } catch (error) {
      console.error('Error initializing map:', error);
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        setIsMapInitialized(false);
      }
    };
  }, [apiKey, initialCoords]);

  // Update markers
  const updateMarkers = useCallback(() => {
    if (!mapRef.current || !isMapInitialized) return;

    const newMarkerMap: { [key: number]: mapboxgl.Marker } = {};

    locations.forEach((location) => {
      let marker = markerMap[location.timestamp];

      if (!marker) {
        marker = new mapboxgl.Marker({
          color:
            location.type === 'current'
              ? 'blue'
              : location.type === 'searched'
              ? 'purple'
              : 'red',
        })
          .setLngLat(location.coordinates)
          .addTo(mapRef.current!);
      } else {
        marker.setLngLat(location.coordinates);
      }

      newMarkerMap[location.timestamp] = marker;
    });

    Object.keys(markerMap).forEach((timestamp) => {
      if (!locations.some((loc) => loc.timestamp === Number(timestamp))) {
        markerMap[Number(timestamp)].remove();
      }
    });

    setMarkerMap(newMarkerMap);

    const currentLocation = locations.find((loc) => loc.type === 'current');
    if (currentLocation) {
      mapRef.current?.flyTo({
        center: currentLocation.coordinates,
        zoom: 14,
        essential: true,
      });
    }
  }, [locations, isMapInitialized, markerMap]);

  // Run marker updates when locations or map initialization changes
  useEffect(() => {
    updateMarkers();
  }, [updateMarkers]);

  return (
    <div className="w-full h-[500px]">
      <div
        ref={mapContainerRef}
        className="w-full h-full rounded-md shadow-lg"
        style={{ minHeight: '400px' }}
      />
    </div>
  );
};

export default Map;