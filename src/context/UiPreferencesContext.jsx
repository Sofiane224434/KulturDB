import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const UI_PREFERENCES_KEY = 'kulturdb_ui_preferences';
const DEFAULT_PREFERENCES = {
  showCardColors: false,
};

function readPreferences() {
  if (typeof window === 'undefined') {
    return DEFAULT_PREFERENCES;
  }

  try {
    const stored = window.localStorage.getItem(UI_PREFERENCES_KEY);
    if (!stored) {
      return DEFAULT_PREFERENCES;
    }

    const parsed = JSON.parse(stored);
    return {
      ...DEFAULT_PREFERENCES,
      ...(parsed && typeof parsed === 'object' ? parsed : {}),
    };
  } catch (_error) {
    return DEFAULT_PREFERENCES;
  }
}

const UiPreferencesContext = createContext(null);

export function UiPreferencesProvider({ children }) {
  const [preferences, setPreferences] = useState(readPreferences);

  useEffect(() => {
    const handleStorage = (event) => {
      if (event.key && event.key !== UI_PREFERENCES_KEY) {
        return;
      }

      setPreferences(readPreferences());
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener('kulturdb-ui-preferences', handleStorage);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('kulturdb-ui-preferences', handleStorage);
    };
  }, []);

  const updatePreferences = (patch) => {
    const nextPreferences = {
      ...readPreferences(),
      ...(patch && typeof patch === 'object' ? patch : {}),
    };

    window.localStorage.setItem(UI_PREFERENCES_KEY, JSON.stringify(nextPreferences));
    setPreferences(nextPreferences);
    window.dispatchEvent(new Event('kulturdb-ui-preferences'));
    return nextPreferences;
  };

  const value = useMemo(
    () => ({
      preferences,
      updatePreferences,
    }),
    [preferences],
  );

  return <UiPreferencesContext.Provider value={value}>{children}</UiPreferencesContext.Provider>;
}

export function useUiPreferences() {
  const context = useContext(UiPreferencesContext);
  if (!context) {
    throw new Error('useUiPreferences must be used within UiPreferencesProvider');
  }

  return context;
}