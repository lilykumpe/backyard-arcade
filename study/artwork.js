// Representative silhouettes for study sets. Choose from the whole set, never from the current card.
const insectOrders = new Set([
  'Archaeognatha','Blattodea','Dermaptera','Diptera','Embioptera','Ephemeroptera','Hemiptera',
  'Hymenoptera','Mantodea','Mecoptera','Megaloptera','Neuroptera','Odonata','Orthoptera',
  'Phasmida','Plecoptera','Psocodea','Raphidioptera','Siphonaptera','Strepsiptera',
  'Thysanoptera','Trichoptera','Zygentoma','Grylloblattodea','Mantophasmatodea','Zoraptera'
]);
const aliases = new Map([
  ['Phasmatodea','Phasmida'],['Isoptera','Blattodea'],['Psocoptera','Psocodea'],['Phthiraptera','Psocodea']
]);
const fungi = new Set(['Fungi','Agaricomycetes','Tremellomycetes','Sordariomycetes','Lecanoromycetes',
  'Pucciniomycetes','Leotiomycetes','Mucoromycetes','Entomophthoromycetes','Pezizomycetes','Dothideomycetes',
  'Eurotiomycetes','Agaricostilbomycetes','Saccharomycetes','Agaricomycotina','Ascomycota','Basidiomycota']);
const fish = new Set(['Actinopterygii','Actinopteri','Chondrichthyes','Elasmobranchii','Holocephali',
  'Myxini','Petromyzontida','Hyperoartia','Dipnoi','Coelacanthi','Cladistia']);
const plants = new Set(['Plantae','Magnoliopsida','Liliopsida','Polypodiopsida','Cycadopsida','Polytrichopsida','Bryopsida']);
const treeGenera = new Set(['Quercus','Fagus','Sequoia','Sequoiadendron','Araucaria','Agathis','Wollemia',
  'Castanospermum','Delonix','Peltophorum','Ginkgo','Toona','Angophora','Corymbia','Eucalyptus','Lophostemon','Pinus']);

export function taxonArt(taxon) {
  taxon = aliases.get(taxon) || taxon;
  if (taxon === 'Coleoptera') return 'beetle.png';
  if (taxon === 'Lepidoptera') return 'icons/butterfly.png';
  if (insectOrders.has(taxon)) return 'icons/' + taxon.toLowerCase() + '.png';
  if (taxon === 'Insecta') return 'icons/insect.png';
  if (taxon === 'Aves') return 'icons/bird.png';
  if (taxon === 'Mammalia') return 'icons/mammal.png';
  if (taxon === 'Pinopsida' || taxon === 'Ginkgoopsida') return 'icons/tree.png';
  if (fungi.has(taxon)) return 'icons/fungi.png';
  if (fish.has(taxon)) return 'icons/fish.png';
  if (plants.has(taxon)) return 'icons/plant.png';
  return '';
}
function subjectArt(p) {
  if (treeGenera.has(p.genus)) return 'icons/tree.png';
  return taxonArt(p.class) || taxonArt(p.iconic);
}
export function setArt(photos, order, group, moths) {
  if (moths) return 'moth.png';
  const orderIcon = taxonArt(order);
  if (orderIcon) return orderIcon;
  if (photos.length) {
    const first = subjectArt(photos[0]);
    if (first && photos.every(p => subjectArt(p) === first)) return first;
    if (photos.every(p => ['icons/plant.png','icons/tree.png'].includes(subjectArt(p)))) return 'icons/plant.png';
  }
  return taxonArt(group) || 'lens.png';
}
