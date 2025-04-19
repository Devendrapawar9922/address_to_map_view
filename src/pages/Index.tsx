import { useState, useEffect, useRef } from 'react';
import Map from '../components/Map';
import { useToast } from '../hooks/use-toast';
import { Button } from '../components/ui/button';
import { Navigation2, X, MapPin } from 'lucide-react';
import mapboxgl from 'mapbox-gl';

interface Location {
  coordinates: [number, number];
  address: string;
  type: 'current' | 'selected' | 'searched';
  timestamp: number;
}

const Index = () => {
  const [locations, setLocations] = useState<Location[]>([]);
  const [mapboxToken, setMapboxToken] = useState<string>('');
  const [isTokenSet, setIsTokenSet] = useState(false);
  const [initialCoords, setInitialCoords] = useState<[number, number] | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(false);
  const { toast } = useToast();
  const searchContainerRef = useRef<HTMLDivElement | null>(null);

  // Handle map clicks
  const handleMapClick = async (e: mapboxgl.MapMouseEvent) => {
    const clickedCoords: [number, number] = [e.lngLat.lng, e.lngLat.lat];

    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${clickedCoords[0]},${clickedCoords[1]}.json?access_token=${mapboxToken}`
      );

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const data = await response.json();
      const address = data.features?.[0]?.place_name || 'Address not available';

      setLocations((prev) => [
        ...prev,
        {
          coordinates: clickedCoords,
          address,
          type: 'selected',
          timestamp: Date.now(),
        },
      ]);

      toast({
        title: 'Location selected!',
        description: 'Marker added to the map',
      });
    } catch (error) {
      console.error('Error getting address:', error);
      toast({
        title: 'Warning',
        description: "Couldn't get address details for selected location",
        variant: 'destructive',
      });
    }
  };

  // Get current location
  const getCurrentLocation = () => {
    if (!mapboxToken || !isTokenSet) {
      toast({
        title: 'API Token Required',
        description: 'Please enter a valid Mapbox API token first',
        variant: 'destructive',
      });
      return;
    }

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { longitude, latitude } = position.coords;

          try {
            const response = await fetch(
              `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?access_token=${mapboxToken}`
            );

            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const data = await response.json();
            const address = data.features?.[0]?.place_name || 'Address not available';

            setLocations((prev) => [
              ...prev,
              {
                coordinates: [longitude, latitude],
                address,
                type: 'current',
                timestamp: Date.now(),
              },
            ]);

            toast({
              title: 'Location found!',
              description: 'Your current location has been added and map centered',
            });
          } catch (error) {
            console.error('Error getting address:', error);
            toast({
              title: 'Warning',
              description: "Found location but couldn't get address details",
              variant: 'destructive',
            });
          }
        },
        (error) => {
          toast({
            title: 'Error',
            description: 'Could not get your current location. ' + error.message,
            variant: 'destructive',
          });
        }
      );
    } else {
      toast({
        title: 'Error',
        description: 'Geolocation is not supported by your browser',
        variant: 'destructive',
      });
    }
  };

  // Handle token submission
  const handleTokenSubmit = () => {
    if (!mapboxToken.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a valid Mapbox token',
        variant: 'destructive',
      });
      return;
    }

    fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/0,0.json?access_token=${mapboxToken}`
    )
      .then((response) => {
        if (!response.ok) {
          throw new Error('Invalid Mapbox API token');
        }

        if ('geolocation' in navigator) {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              const { longitude, latitude } = position.coords;
              setInitialCoords([longitude, latitude]);
              setIsTokenSet(true);
              toast({
                title: 'Token Set',
                description: 'Mapbox token set and map centered on your location',
              });
            },
            (error) => {
              console.error('Error getting initial location:', error);
              setInitialCoords(null);
              setIsTokenSet(true);
              toast({
                title: 'Token Set',
                description: 'Mapbox token set, but could not get your location. Using default location.',
              });
            }
          );
        } else {
          setInitialCoords(null);
          setIsTokenSet(true);
          toast({
            title: 'Token Set',
            description: 'Mapbox token set, but geolocation is not supported. Using default location.',
          });
        }
      })
      .catch((error) => {
        console.error('Error validating token:', error);
        toast({
          title: 'Error',
          description: 'Invalid Mapbox API token. Please check and try again.',
          variant: 'destructive',
        });
      });
  };

  // Remove location
  const removeLocation = (timestamp: number) => {
    setLocations((prev) => prev.filter((loc) => loc.timestamp !== timestamp));
  };

  // Fetch address suggestions
  useEffect(() => {
    if (!mapboxToken || !isTokenSet || !searchQuery.trim()) {
      setSuggestions([]);
      return;
    }

    const fetchSuggestions = async () => {
      try {
        // Use proximity if initialCoords are available
        const proximityParam = initialCoords
          ? `&proximity=${initialCoords[0]},${initialCoords[1]}`
          : '';
        const response = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
            searchQuery
          )}.json?access_token=${mapboxToken}&autocomplete=true&limit=5&types=address,poi${proximityParam}&country=IN`
        );

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const data = await response.json();
        setSuggestions(data.features || []);
        setIsSuggestionsOpen(true);
      } catch (error) {
        console.error('Error fetching suggestions:', error);
        toast({
          title: 'Error',
          description: 'Could not fetch address suggestions',
          variant: 'destructive',
        });
        setSuggestions([]);
      }
    };

    // Debounce to avoid excessive API calls
    const timeoutId = setTimeout(fetchSuggestions, 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery, mapboxToken, isTokenSet, initialCoords, toast]);

  // Handle suggestion selection
  const handleSuggestionSelect = (feature: any) => {
    const coordinates: [number, number] = feature.geometry.coordinates;
    const address = feature.place_name || 'Address not available';

    setLocations((prev) => [
      ...prev,
      {
        coordinates,
        address,
        type: 'searched',
        timestamp: Date.now(),
      },
    ]);

    setSearchQuery('');
    setSuggestions([]);
    setIsSuggestionsOpen(false);

    toast({
      title: 'Location added!',
      description: 'Searched location has been added to the map',
    });
  };

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target as Node)
      ) {
        setIsSuggestionsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-8">Location Viewer</h1>
        {!isTokenSet ? (
          <div className="mb-4">
            <label htmlFor="mapbox-key" className="block text-sm font-medium text-gray-700 mb-1">
              Enter your Mapbox API key to initialize the app
            </label>
            <div className="flex gap-2">
              <input
                id="mapbox-key"
                type="text"
                value={mapboxToken}
                onChange={(e) => setMapboxToken(e.target.value)}
                placeholder="Paste your Mapbox API key here"
                className="flex-1 px-4 py-2 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleTokenSubmit}
                disabled={!mapboxToken.trim()}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 transition-colors"
              >
                Set Token
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              You can get a Mapbox API key from{' '}
              <a
                href="https://account.mapbox.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:underline"
              >
                mapbox.com
              </a>
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <Button
              onClick={getCurrentLocation}
              className="w-full flex items-center gap-2 bg-blue-500 hover:bg-blue-600"
            >
              <Navigation2 className="w-4 h-4" />
              Get Current Location
            </Button>
            <div className="relative" ref={searchContainerRef}>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search for a location..."
                className="w-full px-4 py-2 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {isSuggestionsOpen && suggestions.length > 0 && (
                <ul className="absolute z-10 w-full bg-white border rounded-lg shadow-lg mt-1 max-h-60 overflow-auto">
                  {suggestions.map((feature) => (
                    <li
                      key={feature.id}
                      className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                      onClick={() => handleSuggestionSelect(feature)}
                    >
                      {feature.place_name}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <Map
              apiKey={mapboxToken}
              onMapClick={handleMapClick}
              locations={locations}
              initialCoords={initialCoords}
            />
            <div className="mt-4 space-y-4">
              <h2 className="text-xl font-semibold">Saved Locations</h2>
              {locations.length === 0 ? (
                <p className="text-gray-500">
                  No locations saved yet. Click on the map, search, or get your current location.
                </p>
              ) : (
                <div className="space-y-3">
                  {locations.map((location) => (
                    <div
                      key={location.timestamp}
                      className="p-4 bg-white rounded-lg shadow-md relative"
                    >
                      <button
                        onClick={() => removeLocation(location.timestamp)}
                        className="absolute top-2 right-2 p-1 text-gray-400 hover:text-red-500"
                        aria-label="Remove location"
                      >
                        <X className="w-4 h-4" />
                      </button>
                      <div className="flex items-start gap-3">
                        <div
                          className={`p-2 rounded-full ${
                            location.type === 'current'
                              ? 'bg-blue-100 text-blue-600'
                              : location.type === 'searched'
                              ? 'bg-purple-100 text-purple-600'
                              : 'bg-green-100 text-green-600'
                          }`}
                        >
                          {location.type === 'current' ? (
                            <Navigation2 className="w-4 h-4" />
                          ) : (
                            <MapPin className="w-4 h-4" />
                          )}
                        </div>
                        <div>
                          <h3 className="font-medium">
                            {location.type === 'current'
                              ? 'Current Location'
                              : location.type === 'searched'
                              ? 'Searched Location'
                              : 'Selected Location'}
                          </h3>
                          <p className="text-gray-700">{location.address}</p>
                          <p className="text-sm text-gray-500 mt-1">
                            Coordinates: {location.coordinates[1].toFixed(4)},{' '}
                            {location.coordinates[0].toFixed(4)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;