import { CompetitorPage } from '@/components/website/alternatives/CompetitorPage';
import { fixedPageMetadata } from '@/components/website/websiteMetadata';

export default function MyFitnessPalAlternativePage() {
  return <CompetitorPage id="myFitnessPal" />;
}

export function generateMetadata() {
  return fixedPageMetadata('alternativesMyFitnessPal');
}
