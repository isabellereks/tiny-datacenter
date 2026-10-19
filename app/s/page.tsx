import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Link from 'next/link';
import { decodeRun } from '@/lib/shareLink';

/** A shared run. Its preview image on X comes from /s/og with the same query. */

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const query = async (p: Props) => {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(await p.searchParams)) if (typeof v === 'string') q.set(k, v);
  return q;
};

export async function generateMetadata(p: Props): Promise<Metadata> {
  const q = await query(p);
  const run = decodeRun(q);
  const h = await headers();
  const origin = `${h.get('x-forwarded-proto') ?? 'http'}://${h.get('host')}`;
  const image = `${origin}/s/og?${q.toString()}`;
  const title = `${run.name}: rating ${run.rating}/100`;
  const description = `${run.floors} floors, ${run.techs} techs, ${run.years} ${run.years === 1 ? 'year' : 'years'}. Build your own in tiny datacenter simulator.`;
  return {
    title, description,
    openGraph: { title, description, images: [{ url: image, width: 1200, height: 630 }] },
    twitter: { card: 'summary_large_image', title, description, images: [image] },
  };
}

export default async function Shared(p: Props) {
  const q = await query(p);
  const run = decodeRun(q);
  return (
    <main className="shared">
      {/* a generated card, so next/image has nothing to optimize */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/s/og?${q.toString()}`} alt={`${run.name}, rating ${run.rating}`} width={1200} height={630} />
      <Link className="pill white" href="/">Build your own datacenter</Link>
    </main>
  );
}
