import type { Metadata } from "next";
import Image from "next/image";
import { getPublicSiteContent } from "@/services/site-content";

export const metadata: Metadata = { title: "Notre histoire" };

export default async function Page() {
  const { story } = await getPublicSiteContent();
  const blocks = story.body.split(/\n\s*\n/).filter(Boolean);
  const headings = new Set(["Le constat d'Abidjan :", "Qui sommes-nous ?", "Notre vision :", "Une gestion rigoureuse, un esprit accessible :", "Aujourd'hui et demain :"]);
  return (
    <>
      <section className="page-hero story-hero">
        <div className="container">
          <p className="eyebrow">Notre histoire</p>
          <h1 className="page-title">{story.title}</h1>
        </div>
      </section>
      <section className="section alt">
        <div className="container story-layout">
          <article className="story-copy">
            {blocks.map((block) =>
              headings.has(block) ? <h2 key={block}>{block}</h2> : <p key={block}>{block}</p>,
            )}
          </article>
          <aside className="story-photo">
            {story.photoUrl ? (
              <Image src={story.photoUrl} alt="Les fondateurs de Come & Eat" fill sizes="(max-width: 800px) 100vw, 38vw" />
            ) : (
              <div className="story-photo-fallback"><span>Come & Eat</span><small>La photo des fondateurs sera bientôt ajoutée.</small></div>
            )}
          </aside>
        </div>
      </section>
    </>
  );
}
