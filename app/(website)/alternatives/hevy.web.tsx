import { CompetitorPage } from '@/components/website/alternatives/CompetitorPage';
import { fixedPageMetadata } from '@/components/website/websiteMetadata';

export default function HevyAlternativePage() {
  return <CompetitorPage id="hevy" />;
}

export function generateMetadata() {
  return fixedPageMetadata('alternativesHevy');
}
