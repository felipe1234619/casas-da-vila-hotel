export const robertBurkeProposal = {
  slug: "robert-burke",

  guest: {
    name: "Robert Burke",
    email: "robert.burke1904@gmail.com",
    guests: 10,
  },

  stay: {
    title: "New Year's Eve 2027",
    checkIn: "27 December 2026",
    checkOut: "3 January 2027",
    nights: 7,
  },

  villas: [
    {
      name: "Casa Grande",
      description: "Two-bedroom villa with private swimming pool",
      nightlyRate: 840,
      image: "/images/villas/casa-grande.jpg",
    },
    {
      name: "Casa Rosada",
      description: "Private one-suite villa",
      nightlyRate: 460,
      image: "/images/villas/casa-rosada.jpg",
    },
    {
      name: "Casa Manga",
      description: "Spacious private one-suite villa",
      nightlyRate: 440,
      image: "/images/villas/casa-manga.jpg",
    },
    {
      name: "Atelier Azul",
      description: "Intimate private one-suite villa",
      nightlyRate: 360,
      image: "/images/villas/atelier-azul.jpg",
    },
  ],

  services: [
    "Daily breakfast",
    "Daily housekeeping",
    "Swimming pool access",
    "Bar service",
    "Private parking",
    "Guest assistance throughout the stay",
  ],

  payment: {
    currency: "GBP",
    depositPercentage: 30,
    notice:
      "Rates are presented in pounds sterling for convenience. The bank transfer will be settled in euros using the exchange rate applicable on the payment date.",
    beneficiary: "CASAS DA VILA HOTEL",
    bank: "BANCO C6 S.A. CAYMAN BRANCH",
    swift: "CSIXKYKY",
    country: "Cayman",
    accountNumber: "1011768478",
    receivingCurrency: "EUR",
    intermediaryBank: "JP Morgan SE, Frankfurt am Main",
    intermediarySwift: "CHASDEFX",
  },

  cancellationPolicy: [
    "The reservation is confirmed upon receipt of the 30% deposit.",
    "The reservation deposit is non-refundable.",
    "The remaining balance must be paid according to the reservation agreement.",
    "Date changes are subject to availability and written approval.",
    "No-show, cancellation or early departure does not entitle the guest to a refund.",
  ],
};

export type Proposal = typeof robertBurkeProposal;