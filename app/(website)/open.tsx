import { Redirect } from 'expo-router';

// Native stub of the web-only `/open` page. The app claims `https://musclog.app/open` and
// `app/+native-intent.tsx` routes it before it gets here; this is only the fallback.
export default function Open() {
  return <Redirect href="/app" />;
}
