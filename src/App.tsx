import { useEffect, useLayoutEffect, useState } from 'react';
import { ensureSetup } from './db/repo';
import { getActiveWorkout } from './db/queries';
import { currentPath, navigate, parseRoute, usePath, type Route } from './router';
import { FeedbackProvider } from './ui/feedback';
import { ErrorBoundary } from './ui/ErrorBoundary';
import { TabBar } from './ui/layout';
import { HomeScreen } from './features/home/HomeScreen';
import { NewWorkoutScreen } from './features/workout/NewWorkoutScreen';
import { WorkoutScreen } from './features/workout/WorkoutScreen';
import { SummaryScreen } from './features/workout/SummaryScreen';
import { HistoryScreen } from './features/history/HistoryScreen';
import { ProgressScreen } from './features/progress/ProgressScreen';
import { MyExercisesScreen } from './features/exercises/MyExercisesScreen';
import { SettingsScreen } from './features/settings/SettingsScreen';

const TAB_SCREENS: Route['name'][] = ['home', 'history', 'progress', 'exercises', 'settings'];

function Screen({ route }: { route: Route }) {
  switch (route.name) {
    case 'home':
      return <HomeScreen />;
    case 'new':
      return <NewWorkoutScreen />;
    case 'workout':
      return <WorkoutScreen id={route.id} />;
    case 'summary':
      return <SummaryScreen id={route.id} />;
    case 'history':
      return <HistoryScreen />;
    case 'progress':
      return <ProgressScreen tab={route.tab} id={route.id} />;
    case 'exercises':
      return <MyExercisesScreen />;
    case 'settings':
      return <SettingsScreen />;
  }
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const path = usePath();
  const route = parseRoute(path);

  useEffect(() => {
    ensureSetup()
      .then(async () => {
        // Reopening the app mid-workout goes straight back to it.
        const active = await getActiveWorkout();
        if (active && parseRoute(currentPath()).name === 'home') navigate(`/workout/${active.id}`, { replace: true });
        setReady(true);
      })
      .catch((e: Error) => setError(e.message || 'Could not open local storage.'));
  }, []);

  useLayoutEffect(() => {
    window.scrollTo(0, 0);
    document.documentElement.dataset.screen = route.name;
  }, [path, route.name]);

  if (error) {
    return (
      <div className="screen boot-error">
        <h1>Couldn't open your data</h1>
        <p>{error}</p>
        <p>If you're in a private browser tab, open LiftLog in a normal tab or from the Home Screen.</p>
      </div>
    );
  }
  if (!ready) return null;

  const routeKey = route.name === 'progress' ? 'progress' : path;
  return (
    <FeedbackProvider>
      <ErrorBoundary key={routeKey}>
        <main className="route">
          <Screen route={route} />
        </main>
      </ErrorBoundary>
      {TAB_SCREENS.includes(route.name) && <TabBar active={route.name} />}
    </FeedbackProvider>
  );
}
