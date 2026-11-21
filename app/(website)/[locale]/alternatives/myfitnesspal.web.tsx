import { CompetitorPage } from '@/components/website/alternatives/CompetitorPage';
import { localeStaticParams } from '@/components/website/localeStaticParams';
import { fixedMetadataFor } from '@/components/website/websiteMetadata';

export default function MyFitnessPalAlternativePage() {
  return <CompetitorPage id="myFitnessPal" />;
}

export const generateStaticParams = localeStaticParams;

export const generateMetadata = fixedMetadataFor('alternativesMyFitnessPal');
