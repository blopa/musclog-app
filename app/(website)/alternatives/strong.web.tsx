import { CompetitorPage } from '@/components/website/alternatives/CompetitorPage';
import { fixedPageMetadata } from '@/components/website/websiteMetadata';

export default function StrongAlternativePage() {
  return <CompetitorPage id="strong" />;
}

export function generateMetadata() {
  return fixedPageMetadata('alternativesStrong');
}
