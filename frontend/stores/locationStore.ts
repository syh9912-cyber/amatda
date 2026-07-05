import { create } from 'zustand';
import * as Location from 'expo-location';
import i18n from '../i18n';
import { showPermissionDisclosure } from '../utils/permissionDisclosure';

interface LocationCoords {
  latitude: number;
  longitude: number;
}

interface LocationState {
  userLocation: LocationCoords | null;
  regionName: string;
  loading: boolean;
  error: string | null;
  requestLocation: () => Promise<void>;
}

const DEFAULT_COORDS: LocationCoords = {
  latitude: 34.815,
  longitude: 126.463,
};
const DEFAULT_REGION = '남악';

export const useLocationStore = create<LocationState>((set, get) => ({
  userLocation: null,
  regionName: DEFAULT_REGION,
  loading: false,
  error: null,

  requestLocation: async () => {
    // Avoid duplicate requests
    if (get().loading) return;
    set({ loading: true, error: null });

    try {
      // Google Play prominent disclosure — 최초(미결정) 1회, OS 권한창 전에 인앱 사전고지
      const cur = await Location.getForegroundPermissionsAsync();
      if (cur.status === 'undetermined') {
        const agreed = await showPermissionDisclosure('location');
        if (!agreed) {
          set({
            userLocation: DEFAULT_COORDS,
            regionName: DEFAULT_REGION,
            loading: false,
            error: i18n.t('location.permissionDenied'),
          });
          return;
        }
      }

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        set({
          userLocation: DEFAULT_COORDS,
          regionName: DEFAULT_REGION,
          loading: false,
          error: i18n.t('location.permissionDenied'),
        });
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

      set({
        userLocation: {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        },
        regionName,
        loading: false,
        error: null,
      });
    } catch {
      set({
        userLocation: DEFAULT_COORDS,
        regionName: DEFAULT_REGION,
        loading: false,
        error: i18n.t('location.unavailable'),
      });
    }
  },
}));
