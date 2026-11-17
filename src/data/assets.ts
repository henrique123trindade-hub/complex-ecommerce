export interface AssetEntry {
  url: string;
  alt: string;
  objectPosition?: string;
  label: string;
}

export const STORE_ASSETS = {
  heroDesktop: {
    url: '/src/assets/images/optimized/complex_campaign_1_5292459e-1672w.webp',
    alt: 'Dois modelos em arquitetura brutalista vestindo camiseta oversized taupe COMPLEX e moletom estonado carvão COMPLEX com jeans wide-leg',
    objectPosition: '50% 8%',
    label: 'Campanha Hero Desktop (16:9)',
  },
  heroMobile: {
    url: '/src/assets/images/optimized/complex_model_hoodie_3_41227f9c-1122w.webp',
    alt: 'Modelo em estúdio vestindo moletom oversized estonado COMPLEX e calça jeans wide-leg arquitetônica',
    objectPosition: '50% 0%',
    label: 'Campanha Hero Mobile (4:5)',
  },
  editorialUrban: {
    url: '/src/assets/images/optimized/complex_model_tee_2_ca8505d2-1122w.webp',
    alt: 'Modelo em galeria de concreto brutalista vestindo camiseta oversized preta estonada COMPLEX e calça jeans wide-leg',
    objectPosition: '50% 12%',
    label: 'Editorial Urbano — Camiseta COMPLEX',
  },
  editorialStudioHoodie: {
    url: '/src/assets/images/optimized/complex_model_hoodie_3_41227f9c-1122w.webp',
    alt: 'Editorial de estúdio com modelo vestindo moletom oversized carvão COMPLEX e calça ampla com patch',
    objectPosition: '50% 0%',
    label: 'Editorial Estúdio — Moletom COMPLEX',
  },
  editorialOuterwear: {
    url: '/src/assets/images/optimized/image_2e7943ba-786w.webp',
    alt: 'Editorial de estúdio com jaqueta puffer volumosa oliva e calça cargo ampla',
    objectPosition: '50% 15%',
    label: 'Editorial Outerwear — Puffer Oliva',
  },
  detailCotton: {
    url: '/src/assets/images/optimized/product_detail_cotton_1794952250261-1200w.webp',
    alt: 'Detalhe macro de moletom heavyweight 480g/m² com costura reforçada e etiqueta neutra em algodão',
    objectPosition: '50% 50%',
    label: 'Detalhe Macro Têxtil (4:3)',
  },
  campaignNight: {
    url: '/src/assets/images/optimized/complex_campaign_dusk_4_87617fd1-1672w.webp',
    alt: 'Campanha COMPLEX ao entardecer em terraço brutalista com modelos em moletom carvão, camiseta taupe e jeans amplo',
    objectPosition: '50% 18%',
    label: 'Campanha Entardecer Urbano (16:9)',
  },
  boxyTeeFront: {
    url: '/src/assets/images/optimized/product_boxy_tee_front_1794952251135-896w.webp',
    alt: 'Camiseta Heavyweight Boxy preta lavada — vista frontal em estúdio',
    objectPosition: '50% 50%',
    label: 'Produto — Boxy Tee Frente',
  },
  boxyTeeBack: {
    url: '/src/assets/images/optimized/product_boxy_tee_back_1794952252777-896w.webp',
    alt: 'Camiseta Heavyweight Boxy preta lavada — vista traseira em estúdio',
    objectPosition: '50% 50%',
    label: 'Produto — Boxy Tee Costas',
  },
  boneTeeFront: {
    url: '/src/assets/images/optimized/product_tee_bone_1794952275758-896w.webp',
    alt: 'Camiseta Oversized Warm Bone em algodão encorpado — vista frontal em estúdio',
    objectPosition: '50% 50%',
    label: 'Produto — Bone Tee Frente',
  },
  hoodieTaupe: {
    url: '/src/assets/images/optimized/product_hoodie_taupe_1794952251370-896w.webp',
    alt: 'Moletom Hoodie 500g/m² Washed Taupe com capuz estruturado sem cordão',
    objectPosition: '50% 50%',
    label: 'Produto — Hoodie Taupe',
  },
  hoodieCharcoal: {
    url: '/src/assets/images/optimized/product_hoodie_charcoal_1794952276198-896w.webp',
    alt: 'Moletom Hoodie 500g/m² Washed Charcoal em estúdio neutro',
    objectPosition: '50% 50%',
    label: 'Produto — Hoodie Charcoal',
  },
  crewneckOlive: {
    url: '/src/assets/images/optimized/product_crewneck_olive_1794952278742-896w.webp',
    alt: 'Moletom Careca Boxy 460g/m² Muted Olive tingido em peça',
    objectPosition: '50% 50%',
    label: 'Produto — Crewneck Oliva',
  },
  cargoOlive: {
    url: '/src/assets/images/optimized/product_cargo_olive_1794952252317-896w.webp',
    alt: 'Calça Cargo Wide-Leg em ripstop de algodão Muted Olive',
    objectPosition: '50% 50%',
    label: 'Produto — Cargo Oliva',
  },
  denimWide: {
    url: '/src/assets/images/optimized/product_denim_wide_1794952276236-896w.webp',
    alt: 'Jeans Wide-Leg arquitetônico preto lavado com recortes geométricos',
    objectPosition: '50% 50%',
    label: 'Produto — Wide Denim',
  },
  jacketShell: {
    url: '/src/assets/images/optimized/product_jacket_shell_1794952276902-896w.webp',
    alt: 'Jaqueta Técnica Cropped Carbon Black com gola alta e bolsos frontais',
    objectPosition: '50% 50%',
    label: 'Produto — Jaqueta Shell',
  },
  accessoriesCapTote: {
    url: '/src/assets/images/optimized/product_accessories_cap_1794952253579-896w.webp',
    alt: 'Boné 6 painéis em sarja lavada e ecobag estruturada em lona sobre bloco de travertino',
    objectPosition: '50% 50%',
    label: 'Produto — Boné & Tote',
  },
} as const satisfies Record<string, AssetEntry>;
