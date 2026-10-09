export interface AvatarOption {
  id: string;
  name: string;
  category:
    | 'dbd_survivors'
    | 'dbd_killers'
    | 'diablo'
    | 'marvelrivals'
    | 'residentevil'
    | 'silenthill'
    | 'borderlands'
    | 'overwatch'
    | 'valorant'
    | 'eurotruck'
    | 'seaofthieves'
    | 'discord';
  categoryLabel: string;
  url: string;
}

// Carrega todas as imagens de avatar via Vite glob import para compatibilidade total em qualquer ambiente (dev, build, subdiretórios, preview)
const avatarModules = import.meta.glob<string>(
  '../assets/avatars/**/*.{png,jpg,jpeg,webp}',
  { eager: true, import: 'default' }
);

/**
 * Resolve qualquer URL de avatar relativa ou absoluta para o asset empacotado pelo Vite.
 * Suporta caminhos como '/avatars/dbd/jane_romero.png', 'dbd/jane_romero.png', URLs HTTP e data URIs.
 */
export function resolveAvatarUrl(pathOrUrl?: string): string {
  if (!pathOrUrl) return '';
  if (pathOrUrl.startsWith('data:') || pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
    return pathOrUrl;
  }
  const clean = pathOrUrl.replace(/^\.?\/?avatars\//, '').replace(/^\//, '');
  const key = `../assets/avatars/${clean}`;
  if (avatarModules[key]) {
    return avatarModules[key];
  }
  const filename = clean.split('/').pop();
  if (filename) {
    const matchedKey = Object.keys(avatarModules).find(k => k.endsWith(`/${filename}`));
    if (matchedKey && avatarModules[matchedKey]) {
      return avatarModules[matchedKey];
    }
  }
  const base = import.meta.env.BASE_URL || './';
  const cleanBase = base.endsWith('/') ? base : `${base}/`;
  return `${cleanBase}avatars/${clean}`;
}

const RAW_AVATAR_OPTIONS: AvatarOption[] = [
  // ==================== DEAD BY DAYLIGHT - SOBREVIVENTES ====================
  {
    id: 'dbd-feng',
    name: 'Feng Min',
    category: 'dbd_survivors',
    categoryLabel: 'DBD - Sobreviventes',
    url: '/avatars/dbd/feng_min.png',
  },
  {
    id: 'dbd-meg',
    name: 'Meg Thomas',
    category: 'dbd_survivors',
    categoryLabel: 'DBD - Sobreviventes',
    url: '/avatars/dbd/meg_thomas.png',
  },
  {
    id: 'dbd-dwight',
    name: 'Dwight Fairfield',
    category: 'dbd_survivors',
    categoryLabel: 'DBD - Sobreviventes',
    url: '/avatars/dbd/dwight_fairfield.png',
  },
  {
    id: 'dbd-claudette',
    name: 'Claudette Morel',
    category: 'dbd_survivors',
    categoryLabel: 'DBD - Sobreviventes',
    url: '/avatars/dbd/claudette_morel.png',
  },
  {
    id: 'dbd-david',
    name: 'David King',
    category: 'dbd_survivors',
    categoryLabel: 'DBD - Sobreviventes',
    url: '/avatars/dbd/david_king.png',
  },
  {
    id: 'dbd-jake',
    name: 'Jake Park',
    category: 'dbd_survivors',
    categoryLabel: 'DBD - Sobreviventes',
    url: '/avatars/dbd/jake_park.png',
  },
  {
    id: 'dbd-nea',
    name: 'Nea Karlsson',
    category: 'dbd_survivors',
    categoryLabel: 'DBD - Sobreviventes',
    url: '/avatars/dbd/nea_karlsson.png',
  },
  {
    id: 'dbd-bill',
    name: 'Bill Overbeck (L4D)',
    category: 'dbd_survivors',
    categoryLabel: 'DBD - Sobreviventes',
    url: '/avatars/dbd/bill_overbeck.png',
  },
  {
    id: 'dbd-laurie',
    name: 'Laurie Strode (Halloween)',
    category: 'dbd_survivors',
    categoryLabel: 'DBD - Sobreviventes',
    url: '/avatars/dbd/laurie_strode.png',
  },
  {
    id: 'dbd-ace',
    name: 'Ace Visconti',
    category: 'dbd_survivors',
    categoryLabel: 'DBD - Sobreviventes',
    url: '/avatars/dbd/ace_visconti.png',
  },
  {
    id: 'dbd-kate',
    name: 'Kate Denson',
    category: 'dbd_survivors',
    categoryLabel: 'DBD - Sobreviventes',
    url: '/avatars/dbd/kate_denson.png',
  },
  {
    id: 'dbd-jane',
    name: 'Jane Romero',
    category: 'dbd_survivors',
    categoryLabel: 'DBD - Sobreviventes',
    url: '/avatars/dbd/jane_romero.png',
  },
  {
    id: 'dbd-cheryl',
    name: 'Cheryl Mason (Silent Hill)',
    category: 'dbd_survivors',
    categoryLabel: 'DBD - Sobreviventes',
    url: '/avatars/dbd/cheryl_mason.png',
  },
  {
    id: 'dbd-leon',
    name: 'Leon S. Kennedy (Resident Evil)',
    category: 'dbd_survivors',
    categoryLabel: 'DBD - Sobreviventes',
    url: '/avatars/dbd/leon_dbd.png',
  },
  {
    id: 'dbd-jill',
    name: 'Jill Valentine (Resident Evil)',
    category: 'dbd_survivors',
    categoryLabel: 'DBD - Sobreviventes',
    url: '/avatars/dbd/jill_dbd.png',
  },

  // ==================== DEAD BY DAYLIGHT - KILLERS ====================
  {
    id: 'dbd-trapper',
    name: 'The Trapper',
    category: 'dbd_killers',
    categoryLabel: 'DBD - Killers',
    url: '/avatars/dbd/trapper.png',
  },
  {
    id: 'dbd-ghostface',
    name: 'Ghost Face',
    category: 'dbd_killers',
    categoryLabel: 'DBD - Killers',
    url: '/avatars/dbd/ghostface.png',
  },
  {
    id: 'dbd-huntress',
    name: 'The Huntress',
    category: 'dbd_killers',
    categoryLabel: 'DBD - Killers',
    url: '/avatars/dbd/huntress.png',
  },
  {
    id: 'dbd-legion',
    name: 'The Legion',
    category: 'dbd_killers',
    categoryLabel: 'DBD - Killers',
    url: '/avatars/dbd/legion.png',
  },
  {
    id: 'dbd-wraith',
    name: 'The Wraith',
    category: 'dbd_killers',
    categoryLabel: 'DBD - Killers',
    url: '/avatars/dbd/wraith.png',
  },
  {
    id: 'dbd-hillbilly',
    name: 'The Hillbilly',
    category: 'dbd_killers',
    categoryLabel: 'DBD - Killers',
    url: '/avatars/dbd/hillbilly.png',
  },
  {
    id: 'dbd-nurse',
    name: 'The Nurse',
    category: 'dbd_killers',
    categoryLabel: 'DBD - Killers',
    url: '/avatars/dbd/nurse.png',
  },
  {
    id: 'dbd-myers',
    name: 'The Shape (Michael Myers)',
    category: 'dbd_killers',
    categoryLabel: 'DBD - Killers',
    url: '/avatars/dbd/myers.png',
  },
  {
    id: 'dbd-hag',
    name: 'The Hag',
    category: 'dbd_killers',
    categoryLabel: 'DBD - Killers',
    url: '/avatars/dbd/hag.png',
  },
  {
    id: 'dbd-clown',
    name: 'The Clown',
    category: 'dbd_killers',
    categoryLabel: 'DBD - Killers',
    url: '/avatars/dbd/clown.png',
  },
  {
    id: 'dbd-spirit',
    name: 'The Spirit',
    category: 'dbd_killers',
    categoryLabel: 'DBD - Killers',
    url: '/avatars/dbd/spirit.png',
  },
  {
    id: 'dbd-oni',
    name: 'The Oni',
    category: 'dbd_killers',
    categoryLabel: 'DBD - Killers',
    url: '/avatars/dbd/oni.png',
  },
  {
    id: 'dbd-pyramidhead',
    name: 'The Executioner (Pyramid Head)',
    category: 'dbd_killers',
    categoryLabel: 'DBD - Killers',
    url: '/avatars/dbd/pyramidhead.png',
  },
  {
    id: 'dbd-blight',
    name: 'The Blight',
    category: 'dbd_killers',
    categoryLabel: 'DBD - Killers',
    url: '/avatars/dbd/blight.png',
  },
  {
    id: 'dbd-nemesis-killer',
    name: 'The Nemesis',
    category: 'dbd_killers',
    categoryLabel: 'DBD - Killers',
    url: '/avatars/dbd/nemesis_dbd.png',
  },
  {
    id: 'dbd-wesker-killer',
    name: 'The Mastermind (Albert Wesker)',
    category: 'dbd_killers',
    categoryLabel: 'DBD - Killers',
    url: '/avatars/dbd/wesker_dbd.png',
  },
  {
    id: 'dbd-sadako',
    name: 'The Onryō (Sadako)',
    category: 'dbd_killers',
    categoryLabel: 'DBD - Killers',
    url: '/avatars/dbd/sadako.png',
  },

  // ==================== DIABLO (DIABLO 3 & DIABLO 4) ====================
  {
    id: 'diablo-lilith',
    name: 'Lilith (Diablo IV)',
    category: 'diablo',
    categoryLabel: 'Diablo (Heróis & Vilões)',
    url: '/avatars/diablo/lilith.jpg',
  },
  {
    id: 'diablo-inarius',
    name: 'Inarius (Diablo IV)',
    category: 'diablo',
    categoryLabel: 'Diablo (Heróis & Vilões)',
    url: '/avatars/diablo/inarius.jpg',
  },
  {
    id: 'diablo-tyrael',
    name: 'Tyrael (Arcanjo da Justiça)',
    category: 'diablo',
    categoryLabel: 'Diablo (Heróis & Vilões)',
    url: '/avatars/diablo/tyrael.jpg',
  },
  {
    id: 'diablo-lord',
    name: 'Diablo (Senhor do Terror)',
    category: 'diablo',
    categoryLabel: 'Diablo (Heróis & Vilões)',
    url: '/avatars/diablo/diablo.png',
  },
  {
    id: 'diablo-malthael',
    name: 'Malthael (Aspecto da Morte)',
    category: 'diablo',
    categoryLabel: 'Diablo (Heróis & Vilões)',
    url: '/avatars/diablo/malthael.jpg',
  },
  {
    id: 'diablo-mephisto',
    name: 'Mephisto (Senhor do Ódio)',
    category: 'diablo',
    categoryLabel: 'Diablo (Heróis & Vilões)',
    url: '/avatars/diablo/mephisto.jpg',
  },
  {
    id: 'diablo-baal',
    name: 'Baal (Senhor da Destruição)',
    category: 'diablo',
    categoryLabel: 'Diablo (Heróis & Vilões)',
    url: '/avatars/diablo/baal.jpg',
  },
  {
    id: 'diablo-necromancer',
    name: 'Necromante (Diablo IV)',
    category: 'diablo',
    categoryLabel: 'Diablo (Heróis & Vilões)',
    url: '/avatars/diablo/necromancer.jpg',
  },
  {
    id: 'diablo-barbarian',
    name: 'Bárbaro (Diablo IV)',
    category: 'diablo',
    categoryLabel: 'Diablo (Heróis & Vilões)',
    url: '/avatars/diablo/barbarian.png',
  },
  {
    id: 'diablo-sorceress',
    name: 'Maga / Feiticeira (Diablo IV)',
    category: 'diablo',
    categoryLabel: 'Diablo (Heróis & Vilões)',
    url: '/avatars/diablo/sorceress.png',
  },
  {
    id: 'diablo-rogue',
    name: 'Renegado / Rogue (Diablo IV)',
    category: 'diablo',
    categoryLabel: 'Diablo (Heróis & Vilões)',
    url: '/avatars/diablo/rogue.png',
  },
  {
    id: 'diablo-druid',
    name: 'Druida (Diablo IV)',
    category: 'diablo',
    categoryLabel: 'Diablo (Heróis & Vilões)',
    url: '/avatars/diablo/druid.png',
  },

  // ==================== MARVEL RIVALS ====================
  {
    id: 'mr-spiderman',
    name: 'Spider-Man (Homem-Aranha)',
    category: 'marvelrivals',
    categoryLabel: 'Marvel Rivals',
    url: '/avatars/marvelrivals/spiderman.png',
  },
  {
    id: 'mr-ironman',
    name: 'Iron Man (Homem de Ferro)',
    category: 'marvelrivals',
    categoryLabel: 'Marvel Rivals',
    url: '/avatars/marvelrivals/ironman.png',
  },
  {
    id: 'mr-magneto',
    name: 'Magneto',
    category: 'marvelrivals',
    categoryLabel: 'Marvel Rivals',
    url: '/avatars/marvelrivals/magneto.png',
  },
  {
    id: 'mr-venom',
    name: 'Venom',
    category: 'marvelrivals',
    categoryLabel: 'Marvel Rivals',
    url: '/avatars/marvelrivals/venom.png',
  },
  {
    id: 'mr-scarlet',
    name: 'Scarlet Witch (Feiticeira Escarlate)',
    category: 'marvelrivals',
    categoryLabel: 'Marvel Rivals',
    url: '/avatars/marvelrivals/scarlet_witch.png',
  },
  {
    id: 'mr-drstrange',
    name: 'Doctor Strange (Doutor Estranho)',
    category: 'marvelrivals',
    categoryLabel: 'Marvel Rivals',
    url: '/avatars/marvelrivals/doctor_strange.png',
  },
  {
    id: 'mr-loki',
    name: 'Loki',
    category: 'marvelrivals',
    categoryLabel: 'Marvel Rivals',
    url: '/avatars/marvelrivals/loki.png',
  },
  {
    id: 'mr-luna',
    name: 'Luna Snow',
    category: 'marvelrivals',
    categoryLabel: 'Marvel Rivals',
    url: '/avatars/marvelrivals/luna_snow.png',
  },
  {
    id: 'mr-punisher',
    name: 'The Punisher (Justiceiro)',
    category: 'marvelrivals',
    categoryLabel: 'Marvel Rivals',
    url: '/avatars/marvelrivals/punisher.png',
  },
  {
    id: 'mr-storm',
    name: 'Storm (Tempestade)',
    category: 'marvelrivals',
    categoryLabel: 'Marvel Rivals',
    url: '/avatars/marvelrivals/storm.png',
  },
  {
    id: 'mr-panther',
    name: 'Black Panther (Pantera Negra)',
    category: 'marvelrivals',
    categoryLabel: 'Marvel Rivals',
    url: '/avatars/marvelrivals/black_panther.png',
  },
  {
    id: 'mr-hela',
    name: 'Hela',
    category: 'marvelrivals',
    categoryLabel: 'Marvel Rivals',
    url: '/avatars/marvelrivals/hela.png',
  },
  {
    id: 'mr-groot',
    name: 'Groot',
    category: 'marvelrivals',
    categoryLabel: 'Marvel Rivals',
    url: '/avatars/marvelrivals/groot.png',
  },
  {
    id: 'mr-wolverine',
    name: 'Wolverine',
    category: 'marvelrivals',
    categoryLabel: 'Marvel Rivals',
    url: '/avatars/marvelrivals/wolverine.png',
  },

  // ==================== RESIDENT EVIL (RE2, RE3, RE4, RE5, RE6, RE7, Village e REmake) ====================
  {
    id: 're-leon',
    name: 'Leon S. Kennedy (RE2 / RE4)',
    category: 'residentevil',
    categoryLabel: 'Resident Evil',
    url: '/avatars/residentevil/leon_kennedy.png',
  },
  {
    id: 're-jill',
    name: 'Jill Valentine (RE1 / RE3 / RE5)',
    category: 'residentevil',
    categoryLabel: 'Resident Evil',
    url: '/avatars/residentevil/jill_valentine.png',
  },
  {
    id: 're-claire',
    name: 'Claire Redfield (RE2 / RE Code: Veronica)',
    category: 'residentevil',
    categoryLabel: 'Resident Evil',
    url: '/avatars/residentevil/claire_redfield.png',
  },
  {
    id: 're-chris',
    name: 'Chris Redfield (RE1 / RE5 / RE6 / RE8)',
    category: 'residentevil',
    categoryLabel: 'Resident Evil',
    url: '/avatars/residentevil/chris_redfield.png',
  },
  {
    id: 're-wesker',
    name: 'Albert Wesker (RE1 / RE5)',
    category: 'residentevil',
    categoryLabel: 'Resident Evil',
    url: '/avatars/residentevil/albert_wesker.png',
  },
  {
    id: 're-nemesis',
    name: 'Nemesis (RE3 Nemesis / Remake)',
    category: 'residentevil',
    categoryLabel: 'Resident Evil',
    url: '/avatars/residentevil/nemesis.png',
  },
  {
    id: 're-ada',
    name: 'Ada Wong (RE2 / RE4 / RE6)',
    category: 'residentevil',
    categoryLabel: 'Resident Evil',
    url: '/avatars/residentevil/ada_wong.png',
  },
  {
    id: 're-dimitrescu',
    name: 'Lady Alcina Dimitrescu (RE Village)',
    category: 'residentevil',
    categoryLabel: 'Resident Evil',
    url: '/avatars/residentevil/lady_dimitrescu.png',
  },
  {
    id: 're-heisenberg',
    name: 'Karl Heisenberg (RE Village)',
    category: 'residentevil',
    categoryLabel: 'Resident Evil',
    url: '/avatars/residentevil/karl_heisenberg.png',
  },
  {
    id: 're-ethan',
    name: 'Ethan Winters (RE7 / RE Village)',
    category: 'residentevil',
    categoryLabel: 'Resident Evil',
    url: '/avatars/residentevil/ethan_winters.png',
  },
  {
    id: 're-jackbaker',
    name: 'Jack Baker (RE7 Biohazard)',
    category: 'residentevil',
    categoryLabel: 'Resident Evil',
    url: '/avatars/residentevil/jack_baker.png',
  },

  // ==================== SILENT HILL & SILENT HILL F ====================
  {
    id: 'sh-shf-protagonist',
    name: 'Protagonista Sakura (Silent Hill f)',
    category: 'silenthill',
    categoryLabel: 'Silent Hill & SH f',
    url: '/avatars/silenthill/shf_protagonist.png',
  },
  {
    id: 'sh-pyramidhead',
    name: 'Pyramid Head (Silent Hill 2)',
    category: 'silenthill',
    categoryLabel: 'Silent Hill & SH f',
    url: '/avatars/silenthill/pyramid_head.png',
  },
  {
    id: 'sh-cheryl',
    name: 'Cheryl Mason / Heather (Silent Hill 3)',
    category: 'silenthill',
    categoryLabel: 'Silent Hill & SH f',
    url: '/avatars/silenthill/cheryl_heather.png',
  },

  // ==================== BORDERLANDS 3 ====================
  {
    id: 'bl3-fl4k',
    name: 'FL4K (Borderlands 3)',
    category: 'borderlands',
    categoryLabel: 'Borderlands 3',
    url: '/avatars/borderlands/fl4k.png',
  },
  {
    id: 'bl3-amara',
    name: 'Amara Siren (Borderlands 3)',
    category: 'borderlands',
    categoryLabel: 'Borderlands 3',
    url: '/avatars/borderlands/amara.png',
  },
  {
    id: 'bl3-zane',
    name: 'Zane Flynt (Borderlands 3)',
    category: 'borderlands',
    categoryLabel: 'Borderlands 3',
    url: '/avatars/borderlands/zane.png',
  },
  {
    id: 'bl3-moze',
    name: 'Moze & Iron Bear (Borderlands 3)',
    category: 'borderlands',
    categoryLabel: 'Borderlands 3',
    url: '/avatars/borderlands/moze.png',
  },
  {
    id: 'bl3-claptrap',
    name: 'Claptrap (Borderlands)',
    category: 'borderlands',
    categoryLabel: 'Borderlands 3',
    url: '/avatars/borderlands/claptrap.jpg',
  },
  {
    id: 'bl3-tinytina',
    name: 'Tiny Tina (Borderlands)',
    category: 'borderlands',
    categoryLabel: 'Borderlands 3',
    url: '/avatars/borderlands/tiny_tina.png',
  },
  {
    id: 'bl3-lilith',
    name: 'Lilith (Firehawk)',
    category: 'borderlands',
    categoryLabel: 'Borderlands 3',
    url: '/avatars/borderlands/lilith_siren.jpg',
  },

  // ==================== OVERWATCH ====================
  {
    id: 'ow-tracer',
    name: 'Tracer',
    category: 'overwatch',
    categoryLabel: 'Overwatch',
    url: '/avatars/overwatch/tracer.png',
  },
  {
    id: 'ow-genji',
    name: 'Genji',
    category: 'overwatch',
    categoryLabel: 'Overwatch',
    url: '/avatars/overwatch/genji.png',
  },
  {
    id: 'ow-dva',
    name: 'D.Va',
    category: 'overwatch',
    categoryLabel: 'Overwatch',
    url: '/avatars/overwatch/dva.png',
  },
  {
    id: 'ow-mercy',
    name: 'Mercy',
    category: 'overwatch',
    categoryLabel: 'Overwatch',
    url: '/avatars/overwatch/mercy.png',
  },
  {
    id: 'ow-reaper',
    name: 'Reaper',
    category: 'overwatch',
    categoryLabel: 'Overwatch',
    url: '/avatars/overwatch/reaper.png',
  },
  {
    id: 'ow-reinhardt',
    name: 'Reinhardt',
    category: 'overwatch',
    categoryLabel: 'Overwatch',
    url: '/avatars/overwatch/reinhardt.png',
  },

  // ==================== VALORANT ====================
  {
    id: 'val-jett',
    name: 'Jett',
    category: 'valorant',
    categoryLabel: 'Valorant',
    url: '/avatars/valorant/jett.png',
  },
  {
    id: 'val-reyna',
    name: 'Reyna',
    category: 'valorant',
    categoryLabel: 'Valorant',
    url: '/avatars/valorant/reyna.png',
  },
  {
    id: 'val-sage',
    name: 'Sage',
    category: 'valorant',
    categoryLabel: 'Valorant',
    url: '/avatars/valorant/sage.png',
  },
  {
    id: 'val-omen',
    name: 'Omen',
    category: 'valorant',
    categoryLabel: 'Valorant',
    url: '/avatars/valorant/omen.png',
  },
  {
    id: 'val-phoenix',
    name: 'Phoenix',
    category: 'valorant',
    categoryLabel: 'Valorant',
    url: '/avatars/valorant/phoenix.png',
  },
  {
    id: 'val-sova',
    name: 'Sova',
    category: 'valorant',
    categoryLabel: 'Valorant',
    url: '/avatars/valorant/sova.png',
  },

  // ==================== EURO TRUCK SIMULATOR 2 ====================
  {
    id: 'ets-scania-770s',
    name: 'Scania 770S V8',
    category: 'eurotruck',
    categoryLabel: 'Euro Truck (Scania & Volvo)',
    url: '/avatars/ets2/scania_770s.jpg',
  },
  {
    id: 'ets-scania-s',
    name: 'Scania S Highline',
    category: 'eurotruck',
    categoryLabel: 'Euro Truck (Scania & Volvo)',
    url: '/avatars/ets2/scania_s.png',
  },
  {
    id: 'ets-volvo-fh16',
    name: 'Volvo FH16 Globetrotter',
    category: 'eurotruck',
    categoryLabel: 'Euro Truck (Scania & Volvo)',
    url: '/avatars/ets2/volvo_fh16.png',
  },
  {
    id: 'ets-volvo-fh4',
    name: 'Volvo FH4 25 Years',
    category: 'eurotruck',
    categoryLabel: 'Euro Truck (Scania & Volvo)',
    url: '/avatars/ets2/volvo_fh4.png',
  },

  // ==================== SEA OF THIEVES ====================
  {
    id: 'sot-skull-logo',
    name: 'Logo Caveira Sea of Thieves',
    category: 'seaofthieves',
    categoryLabel: 'Sea of Thieves',
    url: '/avatars/seaofthieves/sot_skull_logo.png',
  },
  {
    id: 'sot-pirate-lord',
    name: 'Pirate Lord (Lenda dos Mares)',
    category: 'seaofthieves',
    categoryLabel: 'Sea of Thieves',
    url: '/avatars/seaofthieves/pirate_lord.png',
  },
  {
    id: 'sot-flameheart',
    name: 'Capitão Flameheart (Chamas)',
    category: 'seaofthieves',
    categoryLabel: 'Sea of Thieves',
    url: '/avatars/seaofthieves/captain_flameheart.png',
  },
  {
    id: 'sot-reapers',
    name: 'Emblema Ceifador (Reaper)',
    category: 'seaofthieves',
    categoryLabel: 'Sea of Thieves',
    url: '/avatars/seaofthieves/reapers_bones.png',
  },
];

export const AVATAR_OPTIONS: AvatarOption[] = RAW_AVATAR_OPTIONS.map(opt => ({
  ...opt,
  url: resolveAvatarUrl(opt.url),
}));
