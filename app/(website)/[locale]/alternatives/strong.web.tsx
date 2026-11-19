import { CompetitorPage } from '@/components/website/alternatives/CompetitorPage';
import { fixedMetadataFor } from '@/components/website/websiteMetadata';
import { localeStaticParams } from '@/components/website/localeStaticParams';

export default function StrongAlternativePage() {
  return <CompetitorPage id="strong" />;
}

export const generateStaticParams = localeStaticParams;

export const generateMetadata = fixedMetadataFor('alternativesStrong');
