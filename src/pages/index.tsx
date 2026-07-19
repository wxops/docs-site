import type { ReactNode } from "react";
import clsx from "clsx";
import Link from "@docusaurus/Link";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import Layout from "@theme/Layout";
import styles from "./index.module.css";

interface Feature {
  title: string;
  description: string;
  link: string;
}

interface FeatureGroup {
  label: string;
  features: Feature[];
}

const featureGroups: FeatureGroup[] = [
  {
    label: "Catalog",
    features: [
      {
        title: "Service Catalog",
        description:
          "Every service, API, database, and team in one searchable view. Ownership, lifecycle, dependencies, and docs — automatically maintained by the platform.",
        link: "/docs/catalog/service-catalog",
      },
      {
        title: "Lifecycle Promotion",
        description:
          "PR-driven, role-gated promotion from experimental to development, staging, and production. Platform team reviews; developers confirm after merge.",
        link: "/docs/catalog/service-catalog#lifecycle-states",
      },
      {
        title: "Multi-Cluster Access",
        description:
          "One Pinniped login grants visibility across all spoke clusters. RBAC-scoped reads: pods, deployments, services, quotas — no cluster credentials exposed.",
        link: "/docs/concepts/architecture",
      },
    ],
  },
  {
    label: "Scaffolding",
    features: [
      {
        title: "Golden-Path Scaffold",
        description:
          "One form in the portal. A complete Gitea repo, Kustomize overlays, Vault secrets, CI/CD pipeline, and catalog entry — created in minutes with zero YAML.",
        link: "/docs/scaffolding/golden-path",
      },
      {
        title: "wxops CLI",
        description:
          "Login, browse the catalog, debug services, sync files, and trigger restarts — all from the terminal without direct Gitea or Kubernetes access.",
        link: "/docs/cli/overview",
      },
    ],
  },
  {
    label: "Darlane",
    features: [
      {
        title: "On-Demand Debug Pods",
        description:
          "Provision a parallel debug deployment alongside the live workload — per environment, role-gated, with inline kubectl and mirrord commands ready to copy.",
        link: "/docs/darlane/debug",
      },
      {
        title: "Live File Sync",
        description:
          "wxops darlane sync watches your local tree and streams changes into the pod via tar-pipe. Deletes propagate, initial full-sync on startup, SIGINT flushes before exit.",
        link: "/docs/darlane/debug",
      },
    ],
  },
];

export default function Home(): ReactNode {
  const { siteConfig } = useDocusaurusContext();

  return (
    <Layout description="Internal Developer Portal documentation — service catalog, golden-path scaffolding, multi-cluster access, and developer inner-loop tooling.">
      <main>
        {/* Hero */}
        <section className={styles.hero}>
          <div className={styles.heroInner}>
            <img
              src="/img/favicon-256x256.png"
              alt=""
              aria-hidden="true"
              className={styles.heroLogo}
            />
            <span className={styles.eyebrow}>Platform Documentation</span>
            <h1 className={styles.heroTitle}>{siteConfig.title}</h1>
            <p className={styles.heroTagline}>{siteConfig.tagline}</p>
            <div className={styles.heroCta}>
              <Link
                className={clsx("button button--lg", styles.ctaPrimary)}
                to="/docs/intro"
              >
                Get Started
              </Link>
              <Link
                className="button button--secondary button--lg"
                to="/docs/concepts/why-wxops"
              >
                Why W'xOps
              </Link>
            </div>
          </div>
        </section>

        {/* Feature groups */}
        <section className={styles.features}>
          <div className={styles.featuresInner}>
            {featureGroups.map((group, gi) => (
              <div
                key={group.label}
                className={clsx(styles.featureGroup, gi > 0 && styles.featureGroupSpaced)}
              >
                <div className={styles.groupHeader}>
                  <span className={styles.groupLabel}>{group.label}</span>
                </div>
                <div className={styles.featuresGrid}>
                  {group.features.map((f) => (
                    <Link
                      key={f.title}
                      to={f.link}
                      className={styles.featureCard}
                    >
                      <h3 className={styles.featureTitle}>{f.title}</h3>
                      <p className={styles.featureDesc}>{f.description}</p>
                      <span className={styles.featureArrow} aria-hidden>
                        →
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Quick links */}
        <section className={styles.quickLinks}>
          <div className={styles.quickLinksInner}>
            <Link
              to="/docs/getting-started/deployment"
              className={styles.quickLink}
            >
              <span className={styles.quickLinkLabel}>Deploy</span>
              <span className={styles.quickLinkDesc}>
                Production deployment guide →
              </span>
            </Link>
            <Link
              to="/docs/getting-started/environment-variables"
              className={styles.quickLink}
            >
              <span className={styles.quickLinkLabel}>Configure</span>
              <span className={styles.quickLinkDesc}>
                Environment variables reference →
              </span>
            </Link>
            <Link
              to="/docs/security/permissions"
              className={styles.quickLink}
            >
              <span className={styles.quickLinkLabel}>Secure</span>
              <span className={styles.quickLinkDesc}>
                Roles & permissions reference →
              </span>
            </Link>
          </div>
        </section>
      </main>
    </Layout>
  );
}
