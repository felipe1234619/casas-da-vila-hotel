import fs from "fs";
import path from "path";

import {
  checkAvailability
} from "./availability/availability-engine.js";



function loadJson(file) {

  try {

    return JSON.parse(
      fs.readFileSync(file, "utf8")
    );

  } catch (error) {

    console.error(
      "Error loading:",
      file,
      error.message
    );

    return {};

  }

}





function detectLanguage(message) {

  const text =
    message.toLowerCase();



  const englishWords = [

    "hello",
    "hi",
    "villa",
    "booking",
    "price",
    "rate",
    "availability",
    "stay",
    "reservation",
    "honeymoon",
    "proposal",
    "quotation"

  ];



  const portugueseWords = [

    "olá",
    "ola",
    "casa",
    "reserva",
    "preço",
    "valor",
    "disponibilidade",
    "hospedagem",
    "estadia",
    "lua de mel",
    "proposta",
    "cotação"

  ];



  const englishScore =
    englishWords.filter(
      word => text.includes(word)
    ).length;



  const portugueseScore =
    portugueseWords.filter(
      word => text.includes(word)
    ).length;



  return englishScore > portugueseScore
    ? "en"
    : "pt";

}







function detectIntent(message) {

  const text =
    message.toLowerCase();



  /*
   * PROPOSTA / COTAÇÃO
   * Sempre primeiro.
   * Evita conflito com "essas casas".
   */

  if (

    [

      "cotação",
      "cotacao",
      "orçamento",
      "orcamento",
      "estimativa",
      "quanto ficaria",
      "valor total",
      "proposal",
      "quotation",
      "proposta"

    ].some(
      keyword =>
        text.includes(keyword)
    )

  ) {

    return "quotation_request";

  }






  /*
   * RESERVA
   */

  if (

    [

      "reservar",
      "reserva",
      "booking",
      "book"

    ].some(
      keyword =>
        text.includes(keyword)
    )

  ) {

    return "booking_request";

  }






  /*
   * PREÇO
   */

  if (

    [

      "preço",
      "preco",
      "valor",
      "quanto custa",
      "tarifa",
      "price",
      "rate",
      "cost"

    ].some(
      keyword =>
        text.includes(keyword)
    )

  ) {

    return "pricing_question";

  }






  /*
   * DISPONIBILIDADE
   */

  if (

    [

      "disponível",
      "disponiveis",
      "disponíveis",
      "disponibilidade",
      "tem vaga",
      "tem disponibilidade",
      "estão disponíveis",
      "estao disponiveis",
      "available",
      "availability"

    ].some(
      keyword =>
        text.includes(keyword)
    )

  ) {

    return "availability_question";

  }






  /*
   * INFORMAÇÕES DE VIAGEM
   */

  if (

    [

      "datas",
      "essas datas",
      "nestas datas",
      "nessas datas",
      "seremos",
      "somos",
      "quantas pessoas",
      "hóspedes",
      "hospedes",
      "quando",
      "janeiro",
      "fevereiro",
      "março",
      "abril",
      "maio",
      "junho",
      "julho",
      "agosto",
      "setembro",
      "outubro",
      "novembro",
      "dezembro"

    ].some(
      keyword =>
        text.includes(keyword)
    )

  ) {

    return "travel_information";

  }






  /*
   * RECOMENDAÇÃO
   */

  if (

    [

      "qual casa",
      "qual villa",
      "qual recomenda",
      "recomenda",
      "ideal",
      "recommend",
      "which villa",
      "best villa",
      "casal",
      "couple",
      "lua de mel",
      "honeymoon",
      "família",
      "family",
      "tranquila",
      "tranquil",
      "privacidade",
      "privacy",
      "procurando",
      "looking for",
      "viagem",
      "trip"

    ].some(
      keyword =>
        text.includes(keyword)
    )

  ) {

    return "villa_recommendation";

  }





  return "general_information";

}









function detectGuestProfile(message) {

  const text =
    message.toLowerCase();



  if (

    [

      "lua de mel",
      "honeymoon",
      "aniversário",
      "anniversary",
      "celebração",
      "celebration"

    ].some(
      keyword =>
        text.includes(keyword)
    )

  ) {

    return "honeymoon";

  }





  if (

    [

      "família",
      "family",
      "crianças",
      "children",
      "4 pessoas",
      "quatro"

    ].some(
      keyword =>
        text.includes(keyword)
    )

  ) {

    return "family_four_guests";

  }





  if (

    [

      "piscina",
      "private pool",
      "pool"

    ].some(
      keyword =>
        text.includes(keyword)
    )

  ) {

    return "private_pool";

  }





  if (

    [

      "casal",
      "couple",
      "dois",
      "two"

    ].some(
      keyword =>
        text.includes(keyword)
    )

  ) {

    return "couple";

  }





  return "couple";

}
function recommendVilla(
  inventory,
  rankingRules,
  profile,
  language
) {


  const ranking =
    rankingRules
      ?.ranking_engine
      ?.guest_profiles
      ?. [profile]
      ?.ranking || [];



  const recommendedVillas =
    ranking
      .map(item => item.villa)
      .filter(name =>
        inventory.villas?.some(
          villa =>
            villa.name === name
        )
      );



  const names =
    recommendedVillas
      .slice(0, 2)
      .join(", ");



  if (!names) {

    return language === "en"

      ? "I would be delighted to help you find the most suitable villa. May I know your travel dates and number of guests?"

      : "Terei prazer em ajudá-lo a encontrar a casa mais adequada. Posso saber suas datas de viagem e o número de hóspedes?";

  }



  if (language === "en") {

    return (

      profile === "honeymoon"

        ?

`For a honeymoon stay, I would be delighted to present options such as ${names}. May I know your travel dates so I can assist you further?`

        :

`For your travel profile, I would be delighted to present options such as ${names}. May I know your travel dates so I can assist you further?`

    );

  }



  return (

    profile === "honeymoon"

      ?

`Para uma lua de mel, eu teria prazer em apresentar opções como ${names}. Posso saber suas datas de viagem para ajudá-lo melhor?`

      :

`Para o perfil da sua viagem, eu teria prazer em apresentar opções como ${names}. Posso saber suas datas de viagem para ajudá-lo melhor?`

  );

}









export async function generateOliviaResponse(
  message,
  context = {}
) {


  const basePath =
    process.cwd();



  const inventory =
    loadJson(

      path.join(
        basePath,
        "knowledge/inventory.json"
      )

    );



  const rankingRules =
    loadJson(

      path.join(
        basePath,
        "knowledge/ranking_rules.json"
      )

    );



  const language =
    detectLanguage(message);



  const intent =
    detectIntent(message);



  const profile =
    detectGuestProfile(message);



  let response = "";





  switch(intent) {





    case "villa_recommendation":


      response =
        recommendVilla(

          inventory,

          rankingRules,

          profile,

          language

        );


      break;







    case "pricing_question":


      response =
        language === "en"

          ?

`I would be happy to provide rates for ${context.recommended_villas?.join(", ") || "our villas"}. May I confirm your travel dates so I can prepare the most accurate information?`

          :

`Terei prazer em informar as tarifas para ${context.recommended_villas?.join(", ") || "nossas casas"}. Posso confirmar suas datas de viagem para preparar a informação mais precisa?`;


      break;







    case "booking_request":


      response =
        language === "en"

          ?

"Wonderful. May I know your arrival date, departure date and number of guests?"

          :

"Perfeito. Posso saber sua data de chegada, saída e o número de hóspedes?";


      break;







    case "availability_question": {


      const availability =
        checkAvailability(

          context.recommended_villas || [],

          context.travel_dates,

          inventory

        );



      const availableNames =
        availability.villas
          ?.map(v => v.villa)
          .filter(Boolean)
          .join(", ")

        ||

        context.recommended_villas
          ?.join(", ")

        ||

        "as casas recomendadas";



      response =
        language === "en"

          ?

`Perfect. I checked availability for ${availableNames} according to your travel dates. May I prepare the next step for your stay?`

          :

`Perfeito. Verifiquei a disponibilidade de ${availableNames} conforme suas datas. Posso preparar a próxima etapa da sua estadia?`;



      break;

    }








    case "quotation_request":


      const villas =
        context.recommended_villas?.join(", ")
        ||
        "as casas recomendadas";



      const checkin =
        context.travel_dates?.checkin
        ||
        "";



      const checkout =
        context.travel_dates?.checkout
        ||
        "";



      response =
        language === "en"

          ?

`I would be happy to prepare a proposal for ${villas} for your stay from ${checkin} to ${checkout}.`

          :

`Perfeito. Vou preparar uma proposta considerando ${villas} para o período de ${checkin} a ${checkout}.`;



      break;







    case "travel_information":


      response =
        language === "en"

          ?

`Perfect. For ${context.guests || "your"} guests looking for a relaxing stay, I would suggest considering ${context.recommended_villas?.join(", ") || "our villas"}. May I check availability for your dates?`

          :

`Perfeito. Para ${context.guests || "vocês"} hóspedes buscando uma estadia tranquila, eu recomendaria considerar ${context.recommended_villas?.join(", ") || "nossas casas"}. Posso verificar a disponibilidade para essas datas?`;



      break;







    default:


      response =
        language === "en"

          ?

"I would be delighted to assist you with information about Casas da Vila Trancoso."

          :

"Terei prazer em ajudá-lo com informações sobre o Casas da Vila Trancoso.";


  }





  return {

    assistant:
      "Olivia",

    language,

    intent,

    profile,

    response

  };


}