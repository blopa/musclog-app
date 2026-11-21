import { CompetitorPage } from '@/components/website/alternatives/CompetitorPage';
import { localeStaticParams } from '@/components/website/localeStaticParams';
import { fixedMetadataFor } from '@/components/website/websiteMetadata';

export default function StrongAlternativePage() {
  return <CompetitorPage id="strong" />;
}

export const generateStaticParams = localeStaticParams;

export const generateMetadata = fixedMetadataFor('alternativesStrong');
