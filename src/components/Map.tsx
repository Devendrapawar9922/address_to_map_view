'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

interface Location {
  coordinates: [number, number];
  address: string;
  type: 'current' | 'selected';
  timestamp: number;
}

interface MapProps {
  apiKey: string;
  onMapClick: (e: mapboxgl.MapMouseEvent) => void;
  locations: Location[];
  initialCoords: [number, number] | null; // New prop for initial coordinates
}

const Map = ({ apiKey, onMapClick, locations, initialCoords }: MapProps) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [markers, setMarkers] = useState<mapboxgl.Marker[]>([]);
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

      // Use user's current location if available, otherwise default
      const center = initialCoords || [defaultCoords.lng, defaultCoords.lat];

      mapRef.current = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: 'mapbox://styles/mapbox/streets-v11',
        center,
        zoom: initialCoords ? 14 : defaultCoords.zoom, // Zoom closer if using current location
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
  }, [apiKey, initialCoords]); // Re-run if apiKey or initialCoords changes

  // Update markers and handle current location
  const updateMarkers = useCallback(() => {
    if (!mapRef.current || !isMapInitialized) return;

    // Remove existing markers
    markers.forEach((marker) => marker.remove());
    setMarkers([]);

    // Add new markers
    const newMarkers = locations.map((location) => {
      const marker = new mapboxgl.Marker({
        color: location.type === 'current' ? 'blue' : 'red',
      })
        .setLngLat(location.coordinates)
        .addTo(mapRef.current!);
      return marker;
    });

    setMarkers(newMarkers);

    // Center map on the latest current location, if any
    const currentLocation = locations.find((loc) => loc.type === 'current');
    if (currentLocation) {
      mapRef.current?.flyTo({
        center: currentLocation.coordinates,
        zoom: 14,
        essential: true,
      });
    }
  }, [locations, isMapInitialized, markers]);

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