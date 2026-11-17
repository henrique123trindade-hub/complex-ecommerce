export interface AssetEntry {
  url: string;
  alt: string;
  objectPosition?: string;
  label: string;
}

export const STORE_ASSETS = {
  heroDesktop: {
    url: '/assets/aistudio/image_e60999db.png',
    alt: 'Dois modelos vestindo camiseta boxy preta lavada e moletom taupe oversized em frente a arquitetura brutalista de concreto',
    objectPosition: '50% 25%',
    label: 'Campanha Hero Desktop (16:9)',
  },
  heroMobile: {
    url: '/src/assets/images/hero_mobile_campaign_1794952246363.jpg',
    alt: 'Campanha vertical COMPLEX com dois modelos em peças oversized sobre concreto aparente',
    objectPosition: '50% 20%',
    label: 'Campanha Hero Mobile (3:4)',
  },
  editorialUrban: {
    url: '/src/assets/images/editorial_urban_tee_1794952249745.jpg',
    alt: 'Modelo caminhando em passarela de concreto brutalista com camiseta boxy vintage preta e jeans wide-leg',
    objectPosition: '50% 18%',
    label: 'Editorial Urbano — Camiseta Boxy',
  },
  editorialStudioHoodie: {
    url: '/assets/aistudio/image_340e3e49.png',
    alt: 'Lookbook de estúdio com modelo vestindo hoodie oversized cinza lavado e jeans amplo escuro',
    objectPosition: '50% 15%',
    label: 'Editorial Estúdio — Hoodie Cinza',
  },
  editorialOuterwear: {
    url: '/assets/aistudio/image_2e7943ba.png',
    alt: 'Editorial de estúdio com jaqueta puffer volumosa oliva e calça cargo ampla',
    objectPosition: '50% 15%',
    label: 'Editorial Outerwear — Puffer Oliva',
  },
  detailCotton: {
    url: '/src/assets/images/product_detail_cotton_1794952250261.jpg',
    alt: 'Detalhe macro de moletom heavyweight 480g/m² com costura reforçada e etiqueta neutra em algodão',
    objectPosition: '50% 50%',
    label: 'Detalhe Macro Têxtil (4:3)',
  },
  campaignNight: {
    url: '/src/assets/images/campaign_night_lifestyle_1794952250620.jpg',
    alt: 'Editorial noturno documental com dois modelos usando outerwear pesado e calças cargo em praça de concreto',
    objectPosition: '50% 20%',
    label: 'Campanha Noturna Lifestyle (3:4)',
  },
  boxyTeeFront: {
    url: '/src/assets/images/product_boxy_tee_front_1794952251135.jpg',
    alt: 'Camiseta Heavyweight Boxy preta lavada — vista frontal em estúdio',
    objectPosition: '50% 50%',
    label: 'Produto — Boxy Tee Frente',
  },
  boxyTeeBack: {
    url: '/src/assets/images/product_boxy_tee_back_1794952252777.jpg',
    alt: 'Camiseta Heavyweight Boxy preta lavada — vista traseira em estúdio',
    objectPosition: '50% 50%',
    label: 'Produto — Boxy Tee Costas',
  },
  boneTeeFront: {
    url: '/src/assets/images/product_tee_bone_1794952275758.jpg',
    alt: 'Camiseta Oversized Warm Bone em algodão encorpado — vista frontal em estúdio',
    objectPosition: '50% 50%',
    label: 'Produto — Bone Tee Frente',
  },
  hoodieTaupe: {
    url: '/src/assets/images/product_hoodie_taupe_1794952251370.jpg',
    alt: 'Moletom Hoodie 500g/m² Washed Taupe com capuz estruturado sem cordão',
    objectPosition: '50% 50%',
    label: 'Produto — Hoodie Taupe',
  },
  hoodieCharcoal: {
    url: '/src/assets/images/product_hoodie_charcoal_1794952276198.jpg',
    alt: 'Moletom Hoodie 500g/m² Washed Charcoal em estúdio neutro',
    objectPosition: '50% 50%',
    label: 'Produto — Hoodie Charcoal',
  },
  crewneckOlive: {
    url: '/src/assets/images/product_crewneck_olive_1794952278742.jpg',
    alt: 'Moletom Careca Boxy 460g/m² Muted Olive tingido em peça',
    objectPosition: '50% 50%',
    label: 'Produto — Crewneck Oliva',
  },
  cargoOlive: {
    url: '/src/assets/images/product_cargo_olive_1794952252317.jpg',
    alt: 'Calça Cargo Wide-Leg em ripstop de algodão Muted Olive',
    objectPosition: '50% 50%',
    label: 'Produto — Cargo Oliva',
  },
  denimWide: {
    url: '/src/assets/images/product_denim_wide_1794952276236.jpg',
    alt: 'Jeans Wide-Leg arquitetônico preto lavado com recortes geométricos',
    objectPosition: '50% 50%',
    label: 'Produto — Wide Denim',
  },
  jacketShell: {
    url: '/src/assets/images/product_jacket_shell_1794952276902.jpg',
    alt: 'Jaqueta Técnica Cropped Carbon Black com gola alta e bolsos frontais',
    objectPosition: '50% 50%',
    label: 'Produto — Jaqueta Shell',
  },
  accessoriesCapTote: {
    url: '/src/assets/images/product_accessories_cap_1794952253579.jpg',
    alt: 'Boné 6 painéis em sarja lavada e ecobag estruturada em lona sobre bloco de travertino',
    objectPosition: '50% 50%',
    label: 'Produto — Boné & Tote',
  },
} as const satisfies Record<string, AssetEntry>;
