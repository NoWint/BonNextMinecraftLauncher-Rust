import { Nav } from './components/Nav';
import { Footer } from './components/Footer';
import { ScrollProgress } from './components/ScrollProgress';
import { SectionDots } from './components/SectionDots';
import { Hero } from './sections/Hero';
import { Manifesto } from './sections/Manifesto';
import { DesignLanguage } from './sections/DesignLanguage';
import { Performance } from './sections/Performance';
import { ContentPlatform } from './sections/ContentPlatform';
import { Architecture } from './sections/Architecture';
import { CrossPlatform } from './sections/CrossPlatform';
import { Download } from './sections/Download';

const SECTIONS = [
  { id: 'hero', label: '首屏' },
  { id: 'manifesto', label: '宣言' },
  { id: 'design', label: '设计' },
  { id: 'performance', label: '性能' },
  { id: 'content', label: '内容' },
  { id: 'architecture', label: '架构' },
  { id: 'cross-platform', label: '跨平台' },
  { id: 'download', label: '下载' },
];

export function App() {
  return (
    <>
      <a href="#hero" className="skip-link">跳到内容</a>
      <ScrollProgress />
      <Nav />
      <SectionDots sections={SECTIONS} />
      <main>
        <Hero />
        <Manifesto />
        <DesignLanguage />
        <Performance />
        <ContentPlatform />
        <Architecture />
        <CrossPlatform />
        <Download />
      </main>
      <Footer />
    </>
  );
}
