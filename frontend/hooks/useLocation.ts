import { useState, useEffect } from 'react';
import * as Location from 'expo-location';

interface LocationState {
  lat: number;
  lng: number;
  regionName: string;
  loading: boolean;
  error: string | null;
}

const DEFAULT_LAT = 34.815;
const DEFAULT_LNG = 126.463;
const DEFAULT_REGION = '남악';

export function useLocation(): LocationState {
  const [state, setState] = useState<LocationState>({
    lat: DEFAULT_LAT,
    lng: DEFAULT_LNG,
    regionName: DEFAULT_REGION,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function fetchLocation() {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          if (!cancelled) {
            setState({
              lat: DEFAULT_LAT,
              lng: DEFAULT_LNG,
              regionName: DEFAULT_REGION,
              loading: false,
              error: '위치 권한이 거부되었습니다',
            });
          }
          return;
        }

        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        let regionName = DEFAULT_REGION;
        try {
          const geocode = await Location.reverseGeocodeAsync({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          });
          if (geocode.length > 0) {
            const g = geocode[0];
            regionName = g.district || g.subregion || g.city || DEFAULT_REGION;
          }
        } catch {
          // geocode fail is non-critical
        }

        if (!cancelled) {
          setState({
            lat: loc.coords.latitude,
            lng: loc.coords.longitude,
            regionName,
            loading: false,
            error: null,
          });
        }
      } catch {
        if (!cancelled) {
          setState({
            lat: DEFAULT_LAT,
            lng: DEFAULT_LNG,
            regionName: DEFAULT_REGION,
            loading: false,
            error: '위치를 가져올 수 없습니다',
          });
        }
      }
    }

    fetchLocation();
    return () => { cancelled = true; };
  }, []);

  return state;
}
