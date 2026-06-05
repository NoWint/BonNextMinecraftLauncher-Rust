import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useI18n } from '../i18n';
import { useInstances } from '../stores/instanceStore';
import type { Crumb } from '../../components/ui/Breadcrumb';

interface BreadcrumbRoute {
  pattern: RegExp;
  build: (match: RegExpMatchArray, t: (key: string) => string, instances: { id: string; name: string }[]) => Crumb[];
}

const ROUTES: BreadcrumbRoute[] = [
  {
    pattern: /^\/home$/,
    build: (_m, t) => [{ label: t('nav.home'), path: '/home' }],
  },
  {
    pattern: /^\/instances\/new$/,
    build: (_m, t) => [
      { label: t('nav.home'), path: '/home' },
      { label: t('nav.instances'), path: '/instances' },
      { label: t('instances.create') },
    ],
  },
  {
    pattern: /^\/instances\/([^/]+)$/,
    build: (m, t, instances) => {
      const id = m[1];
      const inst = instances.find((i) => i.id === id);
      return [
        { label: t('nav.home'), path: '/home' },
        { label: t('nav.instances'), path: '/instances' },
        { label: inst?.name || id },
      ];
    },
  },
  {
    pattern: /^\/instances$/,
    build: (_m, t) => [
      { label: t('nav.home'), path: '/home' },
      { label: t('nav.instances'), path: '/instances' },
    ],
  },
  {
    pattern: /^\/store\/([^/]+)\/([^/]+)$/,
    build: (m, t) => {
      const type = m[1];
      const slug = m[2];
      const typeKey: Record<string, string> = {
        mod: 'contentDetail.typeMods',
        modpack: 'contentDetail.typeModpacks',
        resourcepack: 'contentDetail.typeResourcePacks',
        shader: 'contentDetail.typeShaders',
        datapack: 'contentDetail.typeDataPacks',
      };
      return [
        { label: t('nav.home'), path: '/home' },
        { label: t('nav.marketplace') || 'Marketplace', path: '/store' },
        { label: t(typeKey[type] || type) },
        { label: slug },
      ];
    },
  },
  {
    pattern: /^\/store$/,
    build: (_m, t) => [
      { label: t('nav.home'), path: '/home' },
      { label: t('nav.marketplace') || 'Marketplace', path: '/store' },
    ],
  },
  {
    pattern: /^\/mods$/,
    build: (_m, t) => [
      { label: t('nav.home'), path: '/home' },
      { label: t('nav.marketplace') || 'Marketplace', path: '/store' },
    ],
  },
  {
    pattern: /^\/collections$/,
    build: (_m, t) => [
      { label: t('nav.home'), path: '/home' },
      { label: t('nav.collections'), path: '/collections' },
    ],
  },
  {
    pattern: /^\/library$/,
    build: (_m, t) => [
      { label: t('nav.home'), path: '/home' },
      { label: t('nav.library'), path: '/library' },
    ],
  },
  {
    pattern: /^\/versions$/,
    build: (_m, t) => [
      { label: t('nav.home'), path: '/home' },
      { label: t('nav.versions'), path: '/versions' },
    ],
  },
  {
    pattern: /^\/settings$/,
    build: (_m, t) => [
      { label: t('nav.home'), path: '/home' },
      { label: t('nav.settings'), path: '/settings' },
    ],
  },
];

export function useBreadcrumb(): Crumb[] {
  const location = useLocation();
  const { t } = useI18n();
  const { state: instState } = useInstances();

  return useMemo(() => {
    const pathname = location.pathname;
    for (const route of ROUTES) {
      const match = pathname.match(route.pattern);
      if (match) {
        return route.build(match, t, instState.instances);
      }
    }
    return [{ label: t('nav.home'), path: '/home' }];
  }, [location.pathname, t, instState.instances]);
}
