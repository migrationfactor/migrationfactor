// Existing Migration Factor content; edit copy here without changing page components.
export interface ImageMeta {
  src: string;
  alt: string;
  width: number;
  height: number;
}

export const images: Record<string, ImageMeta> = {
  hero: { src: '/media/hero.webp', alt: 'Family with luggage at an airport', width: 1900, height: 950 },
  about: { src: '/media/about.webp', alt: 'Reference photograph of a visa consultant', width: 800, height: 800 },
  enquiry: { src: '/media/enquiry.webp', alt: 'Traveller holding a passport and travel documents', width: 600, height: 872 },
  cta: { src: '/media/cta.webp', alt: 'Traveller with luggage and a passport', width: 700, height: 729 },
  preparation: { src: '/media/getting-started.webp', alt: 'Student preparing an overseas education profile', width: 1264, height: 848 },
  documents: { src: '/media/document-checklist.webp', alt: 'Visa consultant reviewing application document checklist', width: 1264, height: 848 },
  featureStudy: { src: '/media/featureStudy.webp', alt: '', width: 128, height: 128 },
  featureAppointment: { src: '/media/featureAppointment.webp', alt: '', width: 128, height: 128 },
  featureResources: { src: '/media/featureResources.webp', alt: '', width: 128, height: 128 },
  processOne: { src: '/media/processOne.webp', alt: '', width: 200, height: 200 },
  processTwo: { src: '/media/processTwo.webp', alt: '', width: 200, height: 200 },
  processThree: { src: '/media/processThree.webp', alt: '', width: 200, height: 200 },
  processTrack: { src: '/media/processTrack.webp', alt: '', width: 1900, height: 173 },
  flagAustralia: { src: '/media/flagAustralia.webp', alt: '', width: 240, height: 240 },
  flagUK: { src: '/media/flagUK.webp', alt: '', width: 160, height: 160 },
  flagCanada: { src: '/media/flagCanada.webp', alt: '', width: 240, height: 240 },
  coachingIELTS: { src: '/media/coachingIELTS.webp', alt: '', width: 120, height: 120 },
  coachingPTE: { src: '/media/coachingPTE.webp', alt: '', width: 120, height: 120 },
  enquiryBackground: { src: '/media/enquiryBackground.webp', alt: '', width: 1920, height: 1068 },
  countryPattern: { src: '/media/countryPattern.webp', alt: '', width: 1900, height: 171 },
};
