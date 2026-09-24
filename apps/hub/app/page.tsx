import { Button, Card } from "@wowpixel-lab/ui";
import { experiments } from "../lib/experiments";

export default function HubPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <header className="mb-12">
        <p className="mb-3 inline-block rounded-full bg-sky-400/10 px-3 py-1 text-xs font-medium uppercase tracking-widest text-sky-300 ring-1 ring-inset ring-sky-400/30">
          lab.wowpixel.app
        </p>
        <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
          wowpixel lab
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-slate-400">
          A test bench for small apps and prototypes — shipped fast, tried out
          live. Pick an experiment below.
        </p>
        <div className="mt-6">
          <Button
            variant="secondary"
            href="https://github.com/goandude/wowpixel-lab"
          >
            View source on GitHub
          </Button>
        </div>
      </header>

      <section aria-label="Experiments">
        <h2 className="mb-5 text-sm font-semibold uppercase tracking-widest text-slate-500">
          Experiments · {experiments.length}
        </h2>
        <div className="grid gap-5 sm:grid-cols-2">
          {experiments.map((exp) => (
            <Card
              key={exp.slug}
              title={exp.name}
              tagline={exp.tagline}
              description={exp.description}
              status={exp.status}
              href={exp.href}
            />
          ))}
        </div>
      </section>

      <footer className="mt-16 border-t border-white/10 pt-6 text-sm text-slate-500">
        Built in the open · more experiments landing soon
      </footer>
    </main>
  );
}
