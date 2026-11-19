import { CompetitorPage } from '@/components/website/alternatives/CompetitorPage';
import { fixedMetadataFor } from '@/components/website/websiteMetadata';
import { localeStaticParams } from '@/components/website/localeStaticParams';

export default function MyFitnessPalAlternativePage() {
  return <CompetitorPage id="myFitnessPal" />;
}

export const generateStaticParams = localeStaticParams;

export const generateMetadata = fixedMetadataFor('alternativesMyFitnessPal');
