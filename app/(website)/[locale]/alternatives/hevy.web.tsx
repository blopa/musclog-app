import { CompetitorPage } from '@/components/website/alternatives/CompetitorPage';
import { localeStaticParams } from '@/components/website/localeStaticParams';
import { fixedMetadataFor } from '@/components/website/websiteMetadata';

export default function HevyAlternativePage() {
  return <CompetitorPage id="hevy" />;
}

export const generateStaticParams = localeStaticParams;

export const generateMetadata = fixedMetadataFor('alternativesHevy');
